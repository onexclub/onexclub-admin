"use server";

import { revalidatePath } from "next/cache";

import { canAssignCustomerProgramPlans } from "@/lib/auth/roles";
import { fetchIntakeCompleteForPrograms } from "@/lib/customers/customer-program-plans";
import { assignPlansWithMatching } from "@/lib/plans/template-matching/assign-with-matching";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
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

  // Hard-filter + soft-score matching with Groq AI fallback (server-side, Node.js)
  const adminSupabase = createServiceRoleSupabaseClient();
  const matchResult = await assignPlansWithMatching(adminSupabase, profileId, outletId, {
    reason,
    triggeredBy: ctx.user.id,
  });

  if (matchResult.error) {
    return {
      error: matchResult.error,
      result: { failures: matchResult.failures, warnings: matchResult.warnings },
    };
  }

  const payload: Record<string, unknown> = {
    exercise_plan_name: matchResult.exercise?.planName,
    diet_plan_name: matchResult.diet?.planName,
    exercise_match_method: matchResult.exercise?.matchMethod,
    diet_match_method: matchResult.diet?.matchMethod,
    warnings: matchResult.warnings,
    failures: matchResult.failures,
  };
  const exerciseName = matchResult.exercise?.planName;
  const dietName = matchResult.diet?.planName;

  revalidatePath(ROUTES.dashboardCustomers);
  revalidatePath(ROUTES.superadminCustomers);
  revalidatePath(dashboardCustomerMembershipPath(membershipId));
  revalidatePath(superadminCustomerMembershipPath(membershipId));

  const parts: string[] = [];
  if (typeof exerciseName === "string") parts.push(`Exercise: ${exerciseName}`);
  if (typeof dietName === "string") parts.push(`Diet: ${dietName}`);
  if (matchResult.warnings?.length) parts.push(matchResult.warnings.join(" · "));

  return {
    success: parts.length
      ? `Program plans assigned — ${parts.join(" · ")}`
      : matchResult.warnings?.length
        ? matchResult.warnings.join(" · ")
        : "Program plans updated.",
    result: payload,
  };
}
