"use server";

import { revalidatePath } from "next/cache";

import { canAssignCustomerProgramPlans } from "@/lib/auth/roles";
import { fetchIntakeCompleteForPrograms } from "@/lib/customers/customer-program-plans";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import {
  ROUTES,
  dashboardCustomerMembershipPath,
  superadminCustomerMembershipPath,
} from "@/utils/routes";

export type AssignCustomerProgramPlansState = {
  error?: string;
  success?: string;
  /** Parsed RPC payload when assignment succeeds — optional for UI toasts. */
  result?: Record<string, unknown>;
};

/**
 * Manually match / rotate exercise + diet templates via `assign_or_rotate_plans`.
 * Mirrors DB auto-assign on intake complete; staff can re-run after intake edits.
 */
export async function assignCustomerProgramPlansAction(
  _prev: AssignCustomerProgramPlansState,
  formData: FormData,
): Promise<AssignCustomerProgramPlansState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canAssignCustomerProgramPlans(ctx.appRole)) {
    return { error: "You do not have permission to assign program plans." };
  }

  const membershipId = String(formData.get("membership_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const hasActiveRaw = String(formData.get("has_active_assignments") ?? "").trim();

  if (!membershipId || !profileId || !outletId) {
    return { error: "Missing member context." };
  }

  if (!canManageOutletForBranchAdmin(ctx, outletId)) {
    return { error: "You cannot manage program plans for that branch." };
  }

  const supabase = await createServerSupabaseClient();

  const intakeComplete = await fetchIntakeCompleteForPrograms(supabase, profileId, outletId);
  if (!intakeComplete) {
    return {
      error:
        "Complete all intake sections (Basic info, Health screening, Diet preferences) before assigning program plans.",
    };
  }

  // Refresh aggregate intake score so matched_score on new assignments is accurate
  await supabase.rpc("compute_member_intake_score", {
    p_profile_id: profileId,
    p_outlet_id: outletId,
  });

  const hasActive = hasActiveRaw === "1" || hasActiveRaw === "true";
  const reason = hasActive ? "preference_change" : "initial";

  const { data, error } = await supabase.rpc("assign_or_rotate_plans", {
    p_profile_id: profileId,
    p_outlet_id: outletId,
    p_form_name: "basic_info",
    p_reason: reason,
    p_triggered_by: ctx.user.id,
  });

  if (error) {
    return { error: error.message };
  }

  const payload = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const exerciseName = payload.exercise_plan_name;
  const dietName = payload.diet_plan_name;

  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(ROUTES.superadminCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(superadminCustomerMembershipPath(membershipId));

  const parts: string[] = [];
  if (typeof exerciseName === "string") parts.push(`Exercise: ${exerciseName}`);
  if (typeof dietName === "string") parts.push(`Diet: ${dietName}`);

  return {
    success: parts.length
      ? `Program plans assigned — ${parts.join(" · ")}`
      : "Program plans updated.",
    result: payload,
  };
}
