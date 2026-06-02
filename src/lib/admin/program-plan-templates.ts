import type { SupabaseClient } from "@supabase/supabase-js";

import type { CustomerProgramPlanType } from "@/lib/customers/customer-program-plans";

/**
 * Row from `plan_templates` for admin catalogue grids.
 *
 * **Reuse:** `/dashboard/diet` + `/dashboard/exercise` via {@link ProgramPlanCatalogClient};
 * same cards/dialog shell as {@link CustomerProgramPlansPanel} on member onboarding.
 */
export type ProgramPlanTemplateListItem = {
  id: string;
  outlet_id: string | null;
  plan_type: CustomerProgramPlanType;
  name: string;
  description: string | null;
  difficulty_level: string;
  duration_weeks: number | null;
  primary_goal: string | null;
  target_gender: string | null;
  min_age: number | null;
  max_age: number | null;
  min_score: number | null;
  max_score: number | null;
  tags: string[] | null;
  is_active: boolean;
};

/** Load exercise or diet templates visible to managed branches (outlet-specific + platform-wide). */
export async function fetchProgramPlanTemplates(
  supabase: SupabaseClient,
  params: {
    outletIds: string[];
    planType: CustomerProgramPlanType;
    includeInactive?: boolean;
  },
): Promise<{ rows: ProgramPlanTemplateListItem[]; error: string | null }> {
  const { outletIds, planType, includeInactive = false } = params;

  if (!outletIds.length) {
    return { rows: [], error: null };
  }

  let query = supabase
    .from("plan_templates")
    .select(
      [
        "id",
        "outlet_id",
        "plan_type",
        "name",
        "description",
        "difficulty_level",
        "duration_weeks",
        "primary_goal",
        "target_gender",
        "min_age",
        "max_age",
        "min_score",
        "max_score",
        "tags",
        "is_active",
      ].join(","),
    )
    .eq("plan_type", planType)
    .is("deleted_at", null)
    .or(`outlet_id.is.null,outlet_id.in.(${outletIds.join(",")})`)
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as unknown as ProgramPlanTemplateListItem[], error: null };
}

/** Human-readable audience line for catalogue cards. */
export function formatTemplateAudience(template: ProgramPlanTemplateListItem): string {
  const gender =
    template.target_gender === "male"
      ? "Male"
      : template.target_gender === "female"
        ? "Female"
        : "Any gender";
  const age =
    template.min_age != null && template.max_age != null
      ? `${template.min_age}–${template.max_age}`
      : template.min_age != null
        ? `${template.min_age}+`
        : template.max_age != null
          ? `Up to ${template.max_age}`
          : "All ages";
  return `${gender} · ${age}`;
}

/** Intake score band shown on catalogue cards when configured on the template. */
export function formatTemplateScoreBand(template: ProgramPlanTemplateListItem): string | null {
  if (template.min_score == null && template.max_score == null) return null;
  if (template.min_score != null && template.max_score != null) {
    return `Score ${template.min_score}–${template.max_score}`;
  }
  if (template.min_score != null) return `Score ${template.min_score}+`;
  return `Score ≤ ${template.max_score}`;
}
