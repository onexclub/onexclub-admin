"use server";

import { revalidatePath } from "next/cache";
import { addDaysFromIsoDate, todayUtcIsoDate } from "@/lib/date-term";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { autoAssignProgramPlansIfReady } from "@/lib/plans/template-matching/auto-assign-after-intake";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  canAssignDedicatedTrainer,
  canAssignMembershipPlan,
  canEditCustomerProfileFields,
  canSuspendMembership,
} from "@/lib/auth/roles";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import { parseProfileVitalsFromFormData } from "@/lib/profile/vitals";
import { auditActorOnUpdate } from "@/lib/supabase/audit-columns";
import {
  contactTakenByOtherProfile,
  formatContactConflictError,
  profileEmailUnchanged,
  profilePhoneUnchanged,
} from "@/lib/customers/customer-lookup";
import { toUserFacingError } from "@/lib/errors/user-facing";
import { normalizeToE164 } from "@/lib/auth/phone-e164";
import { canEditOnboardingSection } from "@/features/onboarding/permissions";
import { fetchResponsesBundle, upsertQuestionsResponse } from "@/features/onboarding/question-responses.service";
import type { OnboardingFormName } from "@/features/onboarding/types";
import { ROUTES, dashboardCustomerMembershipPath, superadminCustomerMembershipPath } from "@/utils/routes";

export type AssignMembershipPlanState = { error?: string; success?: string };

const STATUSES_NEED_AUTO_TERM = new Set(["expired", "pending", "inactive", "suspended"]);

/**
 * Attaches/replaces `plan_id` and optionally resets term dates — used after offline cash/card payments.
 * Mirrors onboarding math: `duration_days` on `membership_plans` drives `end_date` when renewing.
 */
export async function assignMembershipPlanAction(
  _prev: AssignMembershipPlanState,
  formData: FormData,
): Promise<AssignMembershipPlanState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canAssignMembershipPlan(ctx.appRole)) return { error: "Forbidden." };

  const membershipId = String(formData.get("membership_id") ?? "").trim();
  const planIdRaw = String(formData.get("plan_id") ?? "").trim();
  if (!membershipId) return { error: "Missing membership." };
  if (!planIdRaw) return { error: "Choose a plan before saving." };

  const supabase = await createServerSupabaseClient();

  const { data: membership, error: memErr } = await supabase
    .from("gym_memberships")
    .select("id, outlet_id, status, profile_id")
    .eq("id", membershipId)
    .is("deleted_at", null)
    .maybeSingle();

  if (memErr) return { error: toUserFacingError(memErr, "Could not load membership.") };
  if (!membership?.outlet_id) return { error: "Membership not found." };
  if (!canManageOutletForBranchAdmin(ctx, membership.outlet_id)) return { error: "You cannot edit that membership." };

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("id,outlet_id,price,currency,name,billing_cycle,duration_days,is_active")
    .eq("id", planIdRaw)
    .is("deleted_at", null)
    .maybeSingle();

  if (planErr) return { error: toUserFacingError(planErr, "Could not load plan.") };
  if (!plan || plan.outlet_id !== membership.outlet_id) return { error: "Plan does not belong to this outlet." };
  if (!plan.is_active) return { error: "That plan is archived; pick an active catalogue row or restore it." };

  const startInput = String(formData.get("start_date") ?? "").trim();
  const start_date = startInput.length ? startInput : todayUtcIsoDate();

  const renewExplicit = formData.get("renew_dates") === "on";
  const offline = formData.get("record_offline_payment") === "on";

  const status = membership.status as string;

  /** Non-active memberships always get a refreshed term window when attaching a paid plan. */
  const renewTerm = STATUSES_NEED_AUTO_TERM.has(status) || renewExplicit;

  const patch: Record<string, unknown> = {
    plan_id: plan.id,
    plan_name: plan.name,
    billing_cycle: plan.billing_cycle ?? null,
  };

  if (renewTerm) {
    patch.status = "active";
    patch.start_date = start_date;

    let end_date: string | null = null;
    if (plan.duration_days != null && Number(plan.duration_days) > 0) {
      const end = addDaysFromIsoDate(start_date, Number(plan.duration_days) - 1);
      end_date = end;
    }

    patch.end_date = end_date;
  }

  if (offline) {
    patch.amount_paid = plan.price;
    patch.currency = (plan.currency as string)?.toUpperCase()?.slice(0, 3) || "INR";
  }

  const { error: updateErr } = await supabase.from("gym_memberships").update(patch).eq("id", membership.id);

  if (updateErr) return { error: toUserFacingError(updateErr, "Could not save plan.") };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(superadminCustomerMembershipPath(membershipId));
  revalidatePath(ROUTES.superadminCustomers);
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.dashboardCustomerNew);
  revalidatePath(ROUTES.dashboardCustomerOnboard);
  revalidatePath(ROUTES.adminMemberOnboard);
  return {
    success: renewTerm ? "Plan saved and membership term updated." : "Plan updated — existing dates unchanged.",
  };
}

export type SimpleActionState = { error?: string; success?: string };

/**
 * Freeze a membership after policy violations or payment defaults.
 * Uses `customers` coarse permissions (`canSuspendMembership`).
 */
export async function suspendMembershipAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canSuspendMembership(ctx.appRole)) return { error: "Forbidden." };

  const membershipId = String(formData.get("membership_id") ?? "").trim();
  if (!membershipId) return { error: "Membership required." };

  const supabase = await createServerSupabaseClient();

  const { data: membership, error: loadErr } = await supabase
    .from("gym_memberships")
    .select("id,outlet_id")
    .eq("id", membershipId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadErr) return { error: toUserFacingError(loadErr, "Could not load membership.") };
  if (!membership?.outlet_id) return { error: "Membership missing." };
  if (!canManageOutletForBranchAdmin(ctx, membership.outlet_id)) return { error: "Forbidden." };

  const { error } = await supabase.from("gym_memberships").update({ status: "suspended" }).eq("id", membershipId);
  if (error) return { error: toUserFacingError(error, "Could not suspend membership.") };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(superadminCustomerMembershipPath(membershipId));
  revalidatePath(ROUTES.superadminCustomers);
  revalidatePath(ROUTES.dashboard);
  return { success: "Membership suspended." };
}

/**
 * Bind a dedicated coach to a membership for trainer-scoped dashboards + RLS on diet/exercise tables.
 */
export async function assignTrainerToMembershipAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canAssignDedicatedTrainer(ctx.appRole)) return { error: "Forbidden." };

  const membershipId = String(formData.get("membership_id") ?? "").trim();
  const trainerProfileId = String(formData.get("trainer_profile_id") ?? "").trim();
  if (!membershipId) return { error: "Membership required." };

  const supabase = await createServerSupabaseClient();

  const { data: membership, error: loadErr } = await supabase
    .from("gym_memberships")
    .select("id,outlet_id")
    .eq("id", membershipId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadErr) return { error: toUserFacingError(loadErr, "Could not load membership.") };
  if (!membership?.outlet_id) return { error: "Membership missing." };
  if (!canManageOutletForBranchAdmin(ctx, membership.outlet_id)) return { error: "Forbidden." };

  const patch =
    trainerProfileId.length === 0
      ? { assigned_trainer_id: null as string | null }
      : { assigned_trainer_id: trainerProfileId };

  const { error } = await supabase.from("gym_memberships").update(patch).eq("id", membershipId);
  if (error) return { error: toUserFacingError(error, "Could not update coach assignment.") };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(superadminCustomerMembershipPath(membershipId));
  revalidatePath(ROUTES.superadminCustomers);
  revalidatePath(ROUTES.dashboard);
  return { success: "Trainer assignment updated." };
}

/**
 * Updates member-facing profile fields for front-desk edits (RLS allows owners/admins/receptionists).
 *
 * **Email:** optional for phone-primary members; when set/changed, updates both `profiles.email` and
 * `auth.users.email` (service role) so sign-in and CRM stay aligned. Clearing the field sets
 * `profiles.email` to null; Auth may still retain a previous address — prefer support tooling if
 * a full unlink is required.
 */
export async function updateCustomerProfileAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canEditCustomerProfileFields(ctx.appRole)) {
    return { error: "Forbidden." };
  }
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const membershipOutletId = String(formData.get("membership_outlet_id") ?? "").trim();
  const membershipRecordId = String(formData.get("membership_id_for_revalidate") ?? "").trim();

  if (!profileId) return { error: "Missing profile." };
  if (!membershipOutletId) return { error: "Missing outlet context." };
  if (!canManageOutletForBranchAdmin(ctx, membershipOutletId)) return { error: "Forbidden." };

  if (emailRaw.length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return { error: "Enter a valid email address or leave it blank." };
    }
  }

  const vitalsParsed = parseProfileVitalsFromFormData(formData);
  if (!vitalsParsed.ok) {
    return { error: vitalsParsed.error };
  }

  const service = createServiceRoleSupabaseClient();

  const { data: existingProfile, error: existingErr } = await service
    .from("profiles")
    .select("phone, email")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingErr) {
    return { error: toUserFacingError(existingErr, "Could not load member profile.") };
  }
  if (!existingProfile) {
    return { error: "Member profile not found." };
  }

  let phoneE164: string | null = null;
  if (phone.length > 0) {
    const phoneNorm = normalizeToE164(phone);
    if (!phoneNorm.ok) {
      return { error: phoneNorm.message };
    }
    phoneE164 = phoneNorm.e164;
  }

  const emailForDb = emailRaw.length > 0 ? emailRaw : null;
  const phoneChanged = !profilePhoneUnchanged(existingProfile.phone, phoneE164);
  const emailChanged = !profileEmailUnchanged(existingProfile.email, emailForDb);

  if (phoneChanged || emailChanged) {
    try {
      const conflict = await contactTakenByOtherProfile(service, {
        profileId,
        phoneRaw: phoneChanged && phoneE164 ? phoneE164 : undefined,
        emailRaw: emailChanged && emailForDb ? emailForDb : undefined,
      });
      const conflictMsg = formatContactConflictError(conflict);
      if (conflictMsg) {
        return { error: conflictMsg };
      }
    } catch (err) {
      return {
        error: toUserFacingError(err, "Could not validate contact details. Please try again."),
      };
    }
  }

  if (emailChanged && emailForDb) {
    const { error: authErr } = await service.auth.admin.updateUserById(profileId, {
      email: emailForDb,
      email_confirm: true,
    });
    if (authErr) return { error: toUserFacingError(authErr, "Could not update email on the login account.") };
  }

  if (phoneChanged && phoneE164) {
    const { error: authPhoneErr } = await service.auth.admin.updateUserById(profileId, {
      phone: phoneE164,
      phone_confirm: true,
    });
    if (authPhoneErr) {
      return { error: toUserFacingError(authPhoneErr, "Could not update mobile on the login account.") };
    }
  }

  const { data: updated, error } = await service
    .from("profiles")
    .update({
      full_name: full_name.length ? full_name : null,
      phone: phoneE164,
      email: emailForDb,
      ...vitalsParsed.patch,
      ...auditActorOnUpdate(ctx.user.id),
    })
    .eq("id", profileId)
    .select("id")
    .maybeSingle();

  if (error) return { error: toUserFacingError(error, "Could not save member details.") };
  if (!updated?.id) {
    return { error: "Could not save member details. Confirm this member belongs to your branch." };
  }

  const skipRevalidate = String(formData.get("skip_revalidate") ?? "") === "1";
  if (!skipRevalidate) {
    revalidatePath(ROUTES.adminCustomers);
    revalidatePath(ROUTES.dashboardCustomers);
    if (membershipRecordId.length) {
      revalidatePath(dashboardCustomerMembershipPath(membershipRecordId));
      revalidatePath(superadminCustomerMembershipPath(membershipRecordId));
    }
    revalidatePath(ROUTES.superadminCustomers);
    revalidatePath(ROUTES.dashboard);
  }
  return { success: "Customer profile updated." };
}

export type SaveQuestionnaireSectionState = { error?: string; success?: boolean };

/**
 * Staff dashboard — persist intake answers with service role (same path as onboard wizard).
 * Client-side PostgREST upserts can fail RLS/trigger edge cases; this action mirrors onboarding.
 */
export async function saveCustomerQuestionnaireSectionAction(payload: {
  profileId: string;
  outletId: string;
  membershipId: string;
  formName: OnboardingFormName;
  answers: Record<string, unknown>;
  finalize: boolean;
}): Promise<SaveQuestionnaireSectionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) return { error: "Sign in required." };
  if (!canEditOnboardingSection(ctx.appRole, payload.formName)) {
    return { error: "Your role cannot update this intake section." };
  }
  if (!canManageOutletForBranchAdmin(ctx, payload.outletId)) {
    return { error: "This member is outside your branch scope." };
  }

  const { profileId, outletId, membershipId, formName, answers, finalize } = payload;
  if (!profileId || !outletId || !formName) {
    return { error: "Missing member or section context." };
  }

  try {
    const service = createServiceRoleSupabaseClient();
    const bundle = await fetchResponsesBundle(service, profileId, outletId);
    const previous = bundle[formName] ?? null;

    await upsertQuestionsResponse({
      supabase: service,
      profileId,
      outletId,
      formName,
      answers,
      actorProfileId: ctx.user.id,
      finalize,
      previous,
    });

    if (finalize) {
      const assignReason =
        formName === "diet_preferences" || formName === "basic_info"
          ? ("preference_change" as const)
          : ("initial" as const);
      const assignOutcome = await autoAssignProgramPlansIfReady(service, profileId, outletId, {
        reason: assignReason,
        triggeredBy: ctx.user.id,
        force: formName === "diet_preferences" || formName === "basic_info",
      });
      if (!assignOutcome.skipped && assignOutcome.result?.error) {
        console.warn("[intake] program plan auto-assign:", assignOutcome.result.error);
      }
    }

    revalidatePath(dashboardCustomerMembershipPath(membershipId));
    revalidatePath(superadminCustomerMembershipPath(membershipId));
    revalidatePath(ROUTES.dashboardCustomers);
    revalidatePath(ROUTES.adminCustomers);
    return { success: true };
  } catch (err) {
    return { error: toUserFacingError(err, "Could not save intake answers. Please try again.") };
  }
}