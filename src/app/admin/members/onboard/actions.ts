"use server";

import { revalidatePath } from "next/cache";
import { addDaysFromIsoDate, todayUtcIsoDate } from "@/lib/date-term";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type AuthDashboardContext,
  canManageOutletForBranchAdmin,
  getAuthDashboardContext,
} from "@/services/auth.service";
import { CUSTOMER_DEBUG_TEMP_PASSWORD } from "@/lib/auth/customer-provisioning";
import { normalizeToE164 } from "@/lib/auth/phone-e164";
import { isAdminConsoleRole } from "@/types/roles";
import {
  ROUTES,
  adminCustomerOnboardingPath,
  dashboardCustomerOnboardingPath,
  dashboardCustomerMembershipPath,
} from "@/utils/routes";
import {
  authCallbackRedirectUrlForEmailVerification,
  sendMemberEmailVerificationLink,
} from "@/lib/email/send-member-email-verification-link";
import { parseProfileVitalsFromFormData } from "@/lib/profile/vitals";
import {
  auditActorOnFirstProfileProvision,
  auditActorOnInsert,
} from "@/lib/supabase/audit-columns";
import { upsertQuestionsResponse } from "@/features/onboarding/question-responses.service";
import type { OnboardingFormName } from "@/features/onboarding/types";
import { ROLES } from "@/lib/auth/roles";
import { findExistingCustomer, contactTakenByOtherProfile, formatContactConflictError } from "@/lib/customers/customer-lookup";
import type { ExistingCustomerLookupResult } from "@/lib/customers/customer-lookup";
import { toUserFacingError } from "@/lib/errors/user-facing";
import {
  loadExistingCustomerPrefill,
  type ExistingCustomerPrefill,
} from "@/lib/customers/customer-onboard-prefill";
import { auditActorOnUpdate } from "@/lib/supabase/audit-columns";

/** Returned to the client wizard (step 2 = questionnaires on the same route). */
export type OnboardMemberWizardState = {
  error?: string;
  /** Populated together on success — client redirects to membership profile. */
  membershipId?: string;
  profileId?: string;
  outletId?: string;
};

export type LookupExistingCustomerState = {
  error?: string;
  result?: ExistingCustomerLookupResult;
};

/** Identity step — match floating customer by phone (preferred) or email before continuing. */
export async function lookupExistingCustomerAction(
  _prev: LookupExistingCustomerState,
  formData: FormData,
): Promise<LookupExistingCustomerState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !isAdminConsoleRole(ctx.appRole)) {
    return { error: "Forbidden." };
  }

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();

  if (!phoneRaw && !emailRaw) {
    return { error: "Enter a mobile number or email to continue." };
  }

  try {
    const service = createServiceRoleSupabaseClient();
    const result = await findExistingCustomer(service, { phone: phoneRaw, email: emailRaw });
    return { result };
  } catch (err) {
    return { error: toUserFacingError(err, "Could not search for an existing member.") };
  }
}

export type LoadExistingCustomerPrefillState = {
  error?: string;
  prefill?: ExistingCustomerPrefill;
};

/** After staff confirm link — load profile + portable questionnaire answers for wizard prefill. */
export async function loadExistingCustomerPrefillAction(
  _prev: LoadExistingCustomerPrefillState,
  formData: FormData,
): Promise<LoadExistingCustomerPrefillState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !isAdminConsoleRole(ctx.appRole)) {
    return { error: "Forbidden." };
  }

  const profileId = String(formData.get("profile_id") ?? "").trim();
  if (!profileId) return { error: "Missing profile." };

  let gymHistory: ExistingCustomerPrefill["profile"]["gym_history"] = [];
  const historyRaw = String(formData.get("gym_history_json") ?? "").trim();
  if (historyRaw.length > 0) {
    try {
      gymHistory = JSON.parse(historyRaw) as ExistingCustomerPrefill["profile"]["gym_history"];
    } catch {
      return { error: "Invalid gym history payload." };
    }
  }

  try {
    const service = createServiceRoleSupabaseClient();
    const prefill = await loadExistingCustomerPrefill(service, profileId, gymHistory);
    return { prefill };
  } catch (err) {
    return { error: toUserFacingError(err, "Could not load member details.") };
  }
}

type PlanResolution = {
  resolvedPlanId: string | null;
  plan_name: string | null;
  billing_cycle: string | null;
  end_date: string | null;
  amount_paid?: number;
  currency?: string;
};

async function resolvePlanForOutlet(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  planIdRaw: string,
  outletId: string,
  start_date: string,
  offlinePaid: boolean,
): Promise<{ ok: true; plan: PlanResolution } | { ok: false; error: string }> {
  const { data: catalogue, error: planErr } = await supabase
    .from("membership_plans")
    .select("id,outlet_id,name,billing_cycle,price,currency,is_active,duration_days")
    .eq("id", planIdRaw)
    .maybeSingle();

  if (planErr || !catalogue?.id) {
    return { ok: false, error: planErr?.message ?? "Plan lookup failed." };
  }

  if (catalogue.outlet_id !== outletId) {
    return { ok: false, error: "Selected catalogue plan belongs to another branch; pick one local to this outlet." };
  }

  if (!catalogue.is_active) {
    return { ok: false, error: "That catalogue plan is archived; re-enable it or pick another SKU." };
  }

  let end_date: string | null = null;
  if (catalogue.duration_days != null && Number(catalogue.duration_days) > 0) {
    end_date = addDaysFromIsoDate(start_date, Number(catalogue.duration_days) - 1) ?? null;
  }

  const plan: PlanResolution = {
    resolvedPlanId: catalogue.id,
    plan_name: catalogue.name ?? null,
    billing_cycle: (catalogue.billing_cycle as string | null | undefined) ?? null,
    end_date,
  };

  if (offlinePaid && catalogue.price != null) {
    plan.amount_paid = Number(catalogue.price);
    plan.currency = (catalogue.currency as string | null)?.toUpperCase()?.slice(0, 3) ?? "INR";
  }

  return { ok: true, plan };
}

async function upsertCustomerMembership(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    profileId: string;
    outletId: string;
    actorId: string;
    plan: PlanResolution;
    start_date: string;
    offlinePaid: boolean;
    trainerProfileId: string;
  },
): Promise<{ ok: true; membershipId: string } | { ok: false; error: string }> {
  const { profileId, outletId, actorId, plan, start_date, offlinePaid, trainerProfileId } = input;

  const membershipPatch: Record<string, unknown> = {
    role: "customer",
    status: "active",
    plan_id: plan.resolvedPlanId,
    plan_name: plan.plan_name,
    billing_cycle: plan.billing_cycle,
    start_date,
    end_date: plan.end_date,
    deleted_at: null,
  };

  if (offlinePaid && plan.amount_paid != null && plan.currency) {
    membershipPatch.amount_paid = plan.amount_paid;
    membershipPatch.currency = plan.currency;
  }

  if (trainerProfileId.length > 0) {
    const { data: trainerRow, error: trainerErr } = await supabase
      .from("staff_assignments")
      .select("profile_id")
      .eq("outlet_id", outletId)
      .eq("profile_id", trainerProfileId)
      .eq("role", ROLES.TRAINER)
      .is("revoked_at", null)
      .maybeSingle();

    if (trainerErr) return { ok: false, error: trainerErr.message };
    if (!trainerRow?.profile_id) {
      return { ok: false, error: "Selected coach is not assigned to this branch." };
    }
    membershipPatch.assigned_trainer_id = trainerProfileId;
  }

  const { data: existingRow, error: existingErr } = await supabase
    .from("gym_memberships")
    .select("id, status, deleted_at")
    .eq("profile_id", profileId)
    .eq("outlet_id", outletId)
    .maybeSingle();

  if (existingErr) return { ok: false, error: existingErr.message };

  if (existingRow?.id) {
    // Active at this branch — refresh profile/questionnaire/plan fields, do not block as duplicate.
    const { data: updated, error: updateErr } = await supabase
      .from("gym_memberships")
      .update({
        ...membershipPatch,
        ...(existingRow.status === "active" && existingRow.deleted_at == null
          ? auditActorOnUpdate(actorId)
          : { onboarded_by: actorId, ...auditActorOnUpdate(actorId) }),
      })
      .eq("id", existingRow.id)
      .select("id")
      .maybeSingle();

    if (updateErr || !updated?.id) {
      return { ok: false, error: updateErr?.message ?? "Could not update membership at this branch." };
    }
    return { ok: true, membershipId: updated.id };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("gym_memberships")
    .insert({
      profile_id: profileId,
      outlet_id: outletId,
      onboarded_by: actorId,
      ...auditActorOnInsert(actorId),
      ...membershipPatch,
    })
    .select("id")
    .maybeSingle();

  if (insertErr || !inserted?.id) {
    return { ok: false, error: insertErr?.message ?? "Membership insert failed." };
  }
  return { ok: true, membershipId: inserted.id };
}

async function persistQuestionnaireBundle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    questionnairePayload: Partial<Record<OnboardingFormName, Record<string, unknown>>> | null;
    profileId: string;
    outletId: string;
    actorId: string;
  },
): Promise<void> {
  const { questionnairePayload, profileId, outletId, actorId } = input;
  if (!questionnairePayload) return;

  for (const [formName, answers] of Object.entries(questionnairePayload)) {
    if (!answers || typeof answers !== "object") continue;
    try {
      await upsertQuestionsResponse({
        supabase,
        profileId,
        outletId,
        formName: formName as OnboardingFormName,
        answers,
        actorProfileId: actorId,
        finalize: true,
        previous: null,
      });
    } catch (err) {
      console.error("[onboard] questionnaire upsert failed:", formName, err);
    }
  }
}

/**
 * Phone-first Auth (OTP) + optional email; mirrors `docs/auth-by-role.md` and `role-sign-in-policy.ts`.
 * Also sets {@link CUSTOMER_DEBUG_TEMP_PASSWORD} on Auth so the Flutter app can sign in with password during QA.
 * `gym_memberships.created_by` (+ legacy `onboarded_by`) = who onboarded; `profiles.created_by` = who provisioned Auth user (first patch).
 */
async function executeOnboardMemberInsert(
  ctx: AuthDashboardContext,
  formData: FormData,
): Promise<{ ok: true; membershipId: string; profileId: string; outletId: string } | { ok: false; error: string }> {
  if (!ctx.user) {
    return { ok: false, error: "Not signed in." };
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const planIdRaw = String(formData.get("plan_id") ?? "").trim();
  const existingProfileIdRaw = String(formData.get("existing_profile_id") ?? "").trim();

  const startInput = String(formData.get("start_date") ?? "").trim();
  const start_date = startInput.length ? startInput : todayUtcIsoDate();

  const offlinePaid = formData.get("record_offline_payment") === "on";

  const phoneNorm = phoneRaw.length > 0 ? normalizeToE164(phoneRaw) : null;
  if (!existingProfileIdRaw && (!phoneNorm || !phoneNorm.ok)) {
    return { ok: false, error: phoneNorm?.message ?? "Mobile number is required for new customers." };
  }

  if (!outletId) {
    return { ok: false, error: "Outlet and mobile number are required." };
  }

  if (!canManageOutletForBranchAdmin(ctx, outletId)) {
    return { ok: false, error: "You cannot create memberships for that outlet." };
  }

  if (offlinePaid && !planIdRaw) {
    return { ok: false, error: "Offline payment recording requires picking a catalogue plan." };
  }

  const vitalsParsed = parseProfileVitalsFromFormData(formData, { mode: "onboard" });
  if (!vitalsParsed.ok) {
    return { ok: false, error: vitalsParsed.error };
  }

  let medical_history_json: Record<string, unknown> | null = null;
  const medicalRaw = String(formData.get("medical_history_json") ?? "").trim();
  if (medicalRaw.length > 0) {
    try {
      medical_history_json = JSON.parse(medicalRaw) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "Invalid medical history payload." };
    }
  }

  type QuestionnairePayload = Partial<
    Record<OnboardingFormName, Record<string, unknown>>
  >;
  let questionnairePayload: QuestionnairePayload | null = null;
  const questionnaireRaw = String(formData.get("questionnaire_payload_json") ?? "").trim();
  if (questionnaireRaw.length > 0) {
    try {
      questionnairePayload = JSON.parse(questionnaireRaw) as QuestionnairePayload;
    } catch {
      return { ok: false, error: "Invalid questionnaire payload." };
    }
  }

  const supabase = await createServerSupabaseClient();
  const service = createServiceRoleSupabaseClient();

  let plan: PlanResolution = {
    resolvedPlanId: planIdRaw || null,
    plan_name: null,
    billing_cycle: null,
    end_date: null,
  };

  if (planIdRaw) {
    const resolved = await resolvePlanForOutlet(supabase, planIdRaw, outletId, start_date, offlinePaid);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    plan = resolved.plan;
  }

  const trainerProfileId = String(formData.get("trainer_profile_id") ?? "").trim();

  // ── PATH A: Link existing floating customer ───────────────────────────────
  if (existingProfileIdRaw.length > 0) {
    const { data: existingProfile, error: profileErr } = await service
      .from("profiles")
      .select("id, full_name, phone, email")
      .eq("id", existingProfileIdRaw)
      .is("deleted_at", null)
      .maybeSingle();

    if (profileErr) return { ok: false, error: profileErr.message };
    if (!existingProfile?.id) {
      return { ok: false, error: "Existing customer profile not found. Go back to Identity and search again." };
    }

    const lookup = await findExistingCustomer(service, { phone: phoneRaw, email });
    if (!lookup.found || lookup.profile_id !== existingProfile.id) {
      return {
        ok: false,
        error: "Contact details no longer match the selected profile. Go back to Identity and search again.",
      };
    }

    const displayName =
      fullName.length ? fullName : existingProfile.full_name?.trim() || existingProfile.phone || "Member";

    const emailForDb = email.length > 0 ? email : null;
    if (emailForDb) {
      try {
        const conflict = await contactTakenByOtherProfile(service, {
          profileId: existingProfile.id,
          emailRaw: emailForDb,
        });
        const conflictMsg = formatContactConflictError(conflict);
        if (conflictMsg) return { ok: false, error: conflictMsg };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Could not validate email.",
        };
      }
    }

    await service
      .from("profiles")
      .update({
        full_name: displayName,
        ...(emailForDb ? { email: emailForDb } : {}),
        ...vitalsParsed.patch,
        ...(medical_history_json ? { medical_history_json } : {}),
        ...auditActorOnUpdate(ctx.user.id),
      })
      .eq("id", existingProfile.id);

    if (emailForDb && emailForDb !== (existingProfile.email ?? "").toLowerCase()) {
      const { error: authEmailErr } = await service.auth.admin.updateUserById(existingProfile.id, {
        email: emailForDb,
        email_confirm: false,
      });
      if (authEmailErr) {
        return { ok: false, error: authEmailErr.message };
      }
    }

    const { error: authPasswordErr } = await service.auth.admin.updateUserById(existingProfile.id, {
      password: CUSTOMER_DEBUG_TEMP_PASSWORD,
    });
    if (authPasswordErr) {
      return { ok: false, error: authPasswordErr.message };
    }

    const membershipResult = await upsertCustomerMembership(supabase, {
      profileId: existingProfile.id,
      outletId,
      actorId: ctx.user.id,
      plan,
      start_date,
      offlinePaid,
      trainerProfileId,
    });

    if (!membershipResult.ok) return { ok: false, error: membershipResult.error };

    await persistQuestionnaireBundle(supabase, {
      questionnairePayload,
      profileId: existingProfile.id,
      outletId,
      actorId: ctx.user.id,
    });

    return {
      ok: true,
      membershipId: membershipResult.membershipId,
      profileId: existingProfile.id,
      outletId,
    };
  }

  // ── PATH B: Create new customer ───────────────────────────────────────────
  if (!phoneNorm?.ok) {
    return { ok: false, error: phoneNorm?.message ?? "Mobile number is required." };
  }

  const priorMatch = await findExistingCustomer(service, { phone: phoneNorm.e164, email });
  if (priorMatch.found) {
    return {
      ok: false,
      error:
        "This mobile number or email belongs to an existing member. Go back to Identity, search again, and link their profile.",
    };
  }

  const createAuthPayload: {
    phone: string;
    phone_confirm: boolean;
    password: string;
    user_metadata: Record<string, string>;
    email?: string;
    email_confirm?: boolean;
  } = {
    phone: phoneNorm.e164,
    phone_confirm: true,
    password: CUSTOMER_DEBUG_TEMP_PASSWORD,
    user_metadata: { full_name: fullName.length ? fullName : phoneNorm.e164 },
  };
  if (email.length > 0) {
    createAuthPayload.email = email;
    /** Phone OTP works immediately; email must be confirmed via magic link we send with Resend (see below). */
    createAuthPayload.email_confirm = false;
  }

  const { data: created, error: authError } = await service.auth.admin.createUser(createAuthPayload);

  if (authError || !created.user) {
    const msg = authError?.message ?? "Failed to create member.";
    if (msg.toLowerCase().includes("already been registered")) {
      return {
        ok: false,
        error:
          "This mobile number is already registered. Go back to Identity, search again, and link the existing profile.",
      };
    }
    return { ok: false, error: msg };
  }

  const displayName = fullName.length ? fullName : phoneNorm.e164;
  await service
    .from("profiles")
    .update({
      full_name: displayName,
      phone: phoneNorm.e164,
      ...(email.length > 0 ? { email } : { email: null }),
      ...vitalsParsed.patch,
      ...(medical_history_json ? { medical_history_json } : {}),
      ...auditActorOnFirstProfileProvision(ctx.user.id),
    })
    .eq("id", created.user.id);

  const membershipResult = await upsertCustomerMembership(supabase, {
    profileId: created.user.id,
    outletId,
    actorId: ctx.user.id,
    plan,
    start_date,
    offlinePaid,
    trainerProfileId,
  });

  if (!membershipResult.ok) {
    return {
      ok: false,
      error: `${membershipResult.error} (Auth user exists; clean up in Supabase if needed.)`,
    };
  }

  await persistQuestionnaireBundle(supabase, {
    questionnairePayload,
    profileId: created.user.id,
    outletId,
    actorId: ctx.user.id,
  });

  if (email.length > 0) {
    const redirectTo = authCallbackRedirectUrlForEmailVerification();
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      email,
      options: { redirectTo },
      type: "magiclink",
    });
    if (linkErr) {
      console.error("[email] generateLink (magiclink) for new member:", linkErr.message);
    } else if (linkData?.properties?.action_link) {
      const verifyResult = await sendMemberEmailVerificationLink({
        actionLink: linkData.properties.action_link,
        memberName: displayName,
        toEmail: email,
      });
      if (verifyResult.error) {
        console.error("[email] Could not send verification email:", verifyResult.error);
      }
    }
  }

  return {
    ok: true,
    membershipId: membershipResult.membershipId,
    profileId: created.user.id,
    outletId,
  };
}

function revalidateOnboardingSurfaces(membershipId: string) {
  revalidatePath(ROUTES.admin);
  revalidatePath(`${ROUTES.staff}/members`);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(ROUTES.dashboardCustomerNew);
  revalidatePath(ROUTES.dashboardCustomerOnboard);
  revalidatePath(ROUTES.adminMemberOnboard);
  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(adminCustomerOnboardingPath(membershipId));
  revalidatePath(dashboardCustomerOnboardingPath(membershipId));
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
}

/** Create member + membership, then hydrate wizard step two with questionnaire panels. */
export async function onboardMemberWizardAction(
  _prev: OnboardMemberWizardState,
  formData: FormData,
): Promise<OnboardMemberWizardState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !isAdminConsoleRole(ctx.appRole)) {
    return { error: "Only gym owners and branch admins can create new member accounts." };
  }

  const result = await executeOnboardMemberInsert(ctx, formData);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidateOnboardingSurfaces(result.membershipId);

  return {
    membershipId: result.membershipId,
    profileId: result.profileId,
    outletId: result.outletId,
  };
}
