import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Active exercise/diet template assignments for a member at one branch.
 *
 * **Data source:** `customer_plan_assignments` + `plan_templates` (Supabase — not in repo migrations yet).
 * **Assignment engine:** DB RPC `assign_or_rotate_plans` (triggered on intake complete or manual staff action).
 *
 * **Reuse:** Pass hydrated snapshot from server pages into {@link CustomerProgramPlansPanel}.
 */
export type CustomerProgramPlanType = "exercise" | "diet";

export type CustomerProgramPlanTemplate = {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number | null;
  difficulty_level: string;
  primary_goal: string | null;
};

export type CustomerProgramPlanAssignment = {
  id: string;
  plan_type: CustomerProgramPlanType;
  status: string;
  progression_tier: string;
  match_method: string;
  matched_score: number | null;
  current_week: number;
  current_day: number;
  start_date: string;
  assigned_at: string;
  rotation_reason: string | null;
  plan_sequence: number;
  template: CustomerProgramPlanTemplate;
};

export type CustomerProgramPlansSnapshot = {
  exercise: CustomerProgramPlanAssignment | null;
  diet: CustomerProgramPlanAssignment | null;
  /** Most recent row per type (includes non-active history when no active row). */
  history: CustomerProgramPlanAssignment[];
  intakeComplete: boolean;
};

type RawRow = {
  id: string;
  plan_type: string;
  status: string;
  progression_tier: string;
  match_method: string;
  matched_score: number | null;
  current_week: number;
  current_day: number;
  start_date: string;
  assigned_at: string;
  rotation_reason: string | null;
  plan_sequence: number;
  plan_templates: CustomerProgramPlanTemplate | CustomerProgramPlanTemplate[] | null;
};

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapRow(raw: RawRow): CustomerProgramPlanAssignment | null {
  const template = firstOrSelf(raw.plan_templates);
  if (!template?.id) return null;
  if (raw.plan_type !== "exercise" && raw.plan_type !== "diet") return null;

  return {
    id: raw.id,
    plan_type: raw.plan_type,
    status: raw.status,
    progression_tier: raw.progression_tier,
    match_method: raw.match_method,
    matched_score: raw.matched_score,
    current_week: raw.current_week,
    current_day: raw.current_day,
    start_date: raw.start_date,
    assigned_at: raw.assigned_at,
    rotation_reason: raw.rotation_reason,
    plan_sequence: raw.plan_sequence,
    template,
  };
}

function pickActive(
  rows: CustomerProgramPlanAssignment[],
  planType: CustomerProgramPlanType,
): CustomerProgramPlanAssignment | null {
  return rows.find((r) => r.plan_type === planType && r.status === "active") ?? null;
}

/** Whether all three intake sections are finalized — required before first auto/manual match. */
export async function fetchIntakeCompleteForPrograms(
  supabase: SupabaseClient,
  profileId: string,
  outletId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("intake_sections_complete", {
    p_profile_id: profileId,
    p_outlet_id: outletId,
  });

  if (error) {
    // Fallback when RPC missing on older DB snapshots
    const { count, error: countErr } = await supabase
      .from("questions_responses")
      .select("form_name", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .eq("is_complete", true)
      .is("deleted_at", null)
      .in("form_name", ["basic_info", "health_screening", "diet_preferences"]);

    if (countErr) return false;
    return (count ?? 0) >= 3;
  }

  return Boolean(data);
}

/** Load active exercise + diet assignments (and recent history) for the member workspace UI. */
export async function fetchCustomerProgramPlans(
  supabase: SupabaseClient,
  profileId: string,
  outletId: string,
): Promise<CustomerProgramPlansSnapshot> {
  const [intakeComplete, assignmentsResult] = await Promise.all([
    fetchIntakeCompleteForPrograms(supabase, profileId, outletId),
    supabase
      .from("customer_plan_assignments")
      .select(
        [
          "id",
          "plan_type",
          "status",
          "progression_tier",
          "match_method",
          "matched_score",
          "current_week",
          "current_day",
          "start_date",
          "assigned_at",
          "rotation_reason",
          "plan_sequence",
          "plan_templates(id,name,description,duration_weeks,difficulty_level,primary_goal)",
        ].join(","),
      )
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .is("deleted_at", null)
      .order("assigned_at", { ascending: false })
      .limit(20),
  ]);

  if (assignmentsResult.error) {
    throw new Error(assignmentsResult.error.message);
  }

  const history = ((assignmentsResult.data ?? []) as unknown as RawRow[])
    .map(mapRow)
    .filter((r): r is CustomerProgramPlanAssignment => r != null);

  return {
    exercise: pickActive(history, "exercise"),
    diet: pickActive(history, "diet"),
    history,
    intakeComplete,
  };
}

/** Human label for `plan_templates.primary_goal` slugs. */
export function formatProgramGoal(slug: string | null | undefined): string {
  if (!slug?.length) return "General";
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
