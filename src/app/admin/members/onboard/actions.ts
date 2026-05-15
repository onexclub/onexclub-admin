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
import { isAdminConsoleRole } from "@/types/roles";
import {
  ROUTES,
  adminCustomerOnboardingPath,
  dashboardCustomerOnboardingPath,
  dashboardCustomerMembershipPath,
} from "@/utils/routes";

/** Returned to the client wizard (step 2 = questionnaires on the same route). */
export type OnboardMemberWizardState = {
  error?: string;
  /** Populated together on success — drives UI into questionnaire panels. */
  membershipId?: string;
  profileId?: string;
  outletId?: string;
};

async function executeOnboardMemberInsert(
  ctx: AuthDashboardContext,
  formData: FormData,
): Promise<{ ok: true; membershipId: string; profileId: string; outletId: string } | { ok: false; error: string }> {
  if (!ctx.user) {
    return { ok: false, error: "Not signed in." };
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const planIdRaw = String(formData.get("plan_id") ?? "").trim();

  const startInput = String(formData.get("start_date") ?? "").trim();
  const start_date = startInput.length ? startInput : todayUtcIsoDate();

  const offlinePaid = formData.get("record_offline_payment") === "on";

  if (!outletId || !email || !password) {
    return { ok: false, error: "Outlet, email, and temporary password are required." };
  }

  if (!canManageOutletForBranchAdmin(ctx, outletId)) {
    return { ok: false, error: "You cannot create memberships for that outlet." };
  }

  if (offlinePaid && !planIdRaw) {
    return { ok: false, error: "Offline payment recording requires picking a catalogue plan." };
  }

  const supabase = await createServerSupabaseClient();

  const resolvedPlanId: string | null = planIdRaw || null;
  let plan_name: string | null = null;
  let billing_cycle: string | null = null;
  let end_date: string | null = null;
  let amount_paid: number | undefined;
  let currency: string | undefined;

  if (planIdRaw) {
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

    plan_name = catalogue.name ?? null;
    billing_cycle = (catalogue.billing_cycle as string | null | undefined) ?? null;
    currency = (catalogue.currency as string | null)?.toUpperCase()?.slice(0, 3) ?? "INR";

    if (catalogue.duration_days != null && Number(catalogue.duration_days) > 0) {
      const tentative = addDaysFromIsoDate(start_date, Number(catalogue.duration_days) - 1);
      end_date = tentative ?? null;
    }

    if (offlinePaid && catalogue.price != null) {
      amount_paid = Number(catalogue.price);
    }
  }

  const service = createServiceRoleSupabaseClient();
  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email },
  });

  if (authError || !created.user) {
    return { ok: false, error: authError?.message ?? "Failed to create member." };
  }

  const insertPayload: Record<string, unknown> = {
    profile_id: created.user.id,
    outlet_id: outletId,
    role: "customer",
    status: "active",
    onboarded_by: ctx.user.id,
    plan_id: resolvedPlanId,
    plan_name,
    billing_cycle,
    start_date,
    end_date,
  };

  if (offlinePaid && resolvedPlanId && amount_paid != null && currency) {
    insertPayload.amount_paid = amount_paid;
    insertPayload.currency = currency;
  }

  const { data: insertedMembership, error: membershipError } = await supabase
    .from("gym_memberships")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (membershipError || !insertedMembership?.id) {
    return {
      ok: false,
      error: `${membershipError?.message ?? "Membership insert failed."} (Auth user exists; clean up in Supabase if needed.)`,
    };
  }

  return {
    ok: true,
    membershipId: insertedMembership.id,
    profileId: created.user.id,
    outletId,
  };
}

function revalidateOnboardingSurfaces(membershipId: string) {
  revalidatePath(ROUTES.admin);
  revalidatePath(`${ROUTES.staff}/members`);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.dashboardCustomers);
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
