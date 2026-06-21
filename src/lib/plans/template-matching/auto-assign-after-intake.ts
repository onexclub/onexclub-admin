import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchIntakeCompleteForPrograms } from "@/lib/customers/customer-program-plans";
import { assignPlansWithMatching } from "./assign-with-matching";

/**
 * App-tier auto-assign (AI-aware) — replaces SQL `assign_or_rotate_plans` on intake complete.
 * **Reuse:** Call after questionnaire upsert in onboard + customer profile actions.
 */
export async function autoAssignProgramPlansIfReady(
  supabase: SupabaseClient,
  profileId: string,
  outletId: string,
  options: {
    reason?: "initial" | "preference_change";
    triggeredBy?: string | null;
    /** Re-match even when active assignments exist (diet/basic info edits). */
    force?: boolean;
  } = {},
) {
  const intakeComplete = await fetchIntakeCompleteForPrograms(supabase, profileId, outletId);
  if (!intakeComplete) {
    return { skipped: true as const, reason: "intake_incomplete" };
  }

  await supabase.rpc("compute_member_intake_score", {
    p_profile_id: profileId,
    p_outlet_id: outletId,
  });

  if (!options.force) {
    const { count } = await supabase
      .from("customer_plan_assignments")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .eq("status", "active")
      .is("deleted_at", null);

    if ((count ?? 0) >= 2) {
      return { skipped: true as const, reason: "already_assigned" };
    }
  }

  const result = await assignPlansWithMatching(supabase, profileId, outletId, {
    reason: options.reason ?? (options.force ? "preference_change" : "initial"),
    triggeredBy: options.triggeredBy ?? null,
  });

  return { skipped: false as const, result };
}
