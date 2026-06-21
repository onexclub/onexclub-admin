import type { SupabaseClient } from "@supabase/supabase-js";

import type { CustomerProgramPlanType } from "./customer-program-plans";

/** Which active template assignment(s) to unlink — history rows stay in the audit trail. */
export type RemoveProgramPlanScope = "exercise" | "diet" | "both";

const SCOPE_TYPES: Record<RemoveProgramPlanScope, CustomerProgramPlanType[]> = {
  exercise: ["exercise"],
  diet: ["diet"],
  both: ["exercise", "diet"],
};

type ActiveRow = {
  id: string;
  plan_type: string;
  plan_templates: { name: string } | { name: string }[] | null;
};

function templateName(raw: ActiveRow["plan_templates"]): string {
  if (raw == null) return "Program plan";
  const row = Array.isArray(raw) ? raw[0] : raw;
  return row?.name?.trim() || "Program plan";
}

/**
 * Soft-unlink active exercise/diet assignments for a member @ branch.
 *
 * **Reuse:** staff “Remove program” action — mirrors cancel path in {@link assign-with-matching}.
 * Does not delete history; sets `status = cancelled` + `deleted_at`.
 */
export async function removeActiveProgramPlanAssignments(
  supabase: SupabaseClient,
  params: {
    profileId: string;
    outletId: string;
    scope: RemoveProgramPlanScope;
    triggeredBy: string | null;
    reason?: string;
  },
): Promise<{ removed: CustomerProgramPlanType[]; removedLabels: string[] }> {
  const { profileId, outletId, scope, triggeredBy, reason = "staff_removed" } = params;
  const planTypes = SCOPE_TYPES[scope];
  const removed: CustomerProgramPlanType[] = [];
  const removedLabels: string[] = [];

  for (const planType of planTypes) {
    const { data: row, error: loadErr } = await supabase
      .from("customer_plan_assignments")
      .select("id, plan_type, plan_templates(name)")
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .eq("plan_type", planType)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (loadErr) throw new Error(loadErr.message);
    if (!row?.id) continue;

    const active = row as ActiveRow;
    const label = templateName(active.plan_templates);
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("customer_plan_assignments")
      .update({
        status: "cancelled",
        deleted_at: nowIso,
        updated_at: nowIso,
        rotation_reason: reason,
      })
      .eq("id", active.id);

    if (updateErr) throw new Error(updateErr.message);

    const { error: eventErr } = await supabase.from("assignment_events").insert({
      assignment_id: active.id,
      profile_id: profileId,
      outlet_id: outletId,
      event_type: "cancelled",
      event_data: {
        reason,
        plan_name: label,
        plan_type: planType,
        staff_unlink: true,
      },
      triggered_by: triggeredBy,
    });

    if (eventErr) throw new Error(eventErr.message);

    removed.push(planType);
    removedLabels.push(`${planType === "exercise" ? "Exercise" : "Diet"}: ${label}`);
  }

  return { removed, removedLabels };
}
