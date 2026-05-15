"use server";

import { revalidatePath } from "next/cache";
import { addDaysFromIsoDate, todayUtcIsoDate } from "@/lib/date-term";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  canAssignDedicatedTrainer,
  canAssignMembershipPlan,
  canEditCustomerProfileFields,
  canSuspendMembership,
} from "@/lib/auth/roles";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES, dashboardCustomerMembershipPath } from "@/utils/routes";

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

  if (memErr) return { error: memErr.message };
  if (!membership?.outlet_id) return { error: "Membership not found." };
  if (!canManageOutletForBranchAdmin(ctx, membership.outlet_id)) return { error: "You cannot edit that membership." };

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("id,outlet_id,price,currency,name,billing_cycle,duration_days,is_active")
    .eq("id", planIdRaw)
    .is("deleted_at", null)
    .maybeSingle();

  if (planErr) return { error: planErr.message };
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

  if (updateErr) return { error: updateErr.message };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.dashboard);
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

  if (loadErr) return { error: loadErr.message };
  if (!membership?.outlet_id) return { error: "Membership missing." };
  if (!canManageOutletForBranchAdmin(ctx, membership.outlet_id)) return { error: "Forbidden." };

  const { error } = await supabase.from("gym_memberships").update({ status: "suspended" }).eq("id", membershipId);
  if (error) return { error: error.message };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
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

  if (loadErr) return { error: loadErr.message };
  if (!membership?.outlet_id) return { error: "Membership missing." };
  if (!canManageOutletForBranchAdmin(ctx, membership.outlet_id)) return { error: "Forbidden." };

  const patch =
    trainerProfileId.length === 0
      ? { assigned_trainer_id: null as string | null }
      : { assigned_trainer_id: trainerProfileId };

  const { error } = await supabase.from("gym_memberships").update(patch).eq("id", membershipId);
  if (error) return { error: error.message };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(ROUTES.dashboard);
  return { success: "Trainer assignment updated." };
}

/**
 * Updates member-facing profile fields for front-desk edits (RLS allows owners/admins/receptionists).
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
  const membershipOutletId = String(formData.get("membership_outlet_id") ?? "").trim();
  const membershipRecordId = String(formData.get("membership_id_for_revalidate") ?? "").trim();

  if (!profileId) return { error: "Missing profile." };
  if (!membershipOutletId) return { error: "Missing outlet context." };
  if (!canManageOutletForBranchAdmin(ctx, membershipOutletId)) return { error: "Forbidden." };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name.length ? full_name : null,
      phone: phone.length ? phone : null,
    })
    .eq("id", profileId);

  if (error) return { error: error.message };

  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  if (membershipRecordId.length) {
    revalidatePath(dashboardCustomerMembershipPath(membershipRecordId));
  }
  revalidatePath(ROUTES.dashboard);
  return { success: "Customer profile updated." };
}