import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanTemplateRow, PlanTemplateType, UserProfile } from "./types";

const TEMPLATE_SELECT = [
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
  "min_bmi",
  "max_bmi",
  "min_score",
  "max_score",
  "tags",
  "constraints",
  "source",
  "status",
  "match_count",
  "is_active",
].join(",");

/**
 * Safe generic plans served when AI diet output cannot be shown (allergies / injuries).
 * High protein, no common allergens, clearly labeled temporary.
 */
export function buildSafeGenericDietTemplate(userProfile: UserProfile): PlanTemplateRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    outlet_id: userProfile.outletId,
    plan_type: "diet",
    name: "Temporary balanced plan (trainer review pending)",
    description:
      "High-protein, allergen-conscious placeholder. Your trainer is preparing a personalized plan.",
    difficulty_level: userProfile.level,
    duration_weeks: 4,
    primary_goal: userProfile.goal,
    target_gender: userProfile.gender === "any" ? null : userProfile.gender,
    min_age: null,
    max_age: null,
    min_bmi: null,
    max_bmi: null,
    min_score: 0,
    max_score: 100,
    tags: ["safe_fallback", "high_protein", "allergen_conscious"],
    constraints: null,
    source: "manual",
    status: "active",
    match_count: 0,
    is_active: true,
  };
}

export function buildSafeGenericExerciseTemplate(userProfile: UserProfile): PlanTemplateRow {
  return {
    id: "00000000-0000-0000-0000-000000000002",
    outlet_id: userProfile.outletId,
    plan_type: "exercise",
    name: "Temporary general fitness plan",
    description: "Basic full-body template while your personalized plan is being created.",
    difficulty_level: userProfile.level,
    duration_weeks: 4,
    primary_goal: userProfile.goal,
    target_gender: userProfile.gender === "any" ? null : userProfile.gender,
    min_age: null,
    max_age: null,
    min_bmi: null,
    max_bmi: null,
    min_score: 0,
    max_score: 100,
    tags: ["safe_fallback", "general_fitness"],
    constraints: null,
    source: "manual",
    status: "active",
    match_count: 0,
    is_active: true,
  };
}

export function buildSafeGenericTemplate(
  userProfile: UserProfile,
  templateType: PlanTemplateType,
): PlanTemplateRow {
  return templateType === "diet"
    ? buildSafeGenericDietTemplate(userProfile)
    : buildSafeGenericExerciseTemplate(userProfile);
}

/** Fetch 2–3 nearest active templates for Groq grounding (partial goal/level match). */
export async function fetchGroundingTemplates(
  supabase: SupabaseClient,
  userProfile: UserProfile,
  templateType: PlanTemplateType,
  limit = 3,
): Promise<PlanTemplateRow[]> {
  const levels = adjacentLevels(userProfile.level);

  const { data, error } = await supabase
    .from("plan_templates")
    .select(TEMPLATE_SELECT)
    .eq("plan_type", templateType)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`outlet_id.eq.${userProfile.outletId},outlet_id.is.null`)
    .in("difficulty_level", levels)
    .limit(limit * 4);

  if (error || !data?.length) return [];

  const rows = data as unknown as PlanTemplateRow[];
  const scored = rows
    .map((row) => ({
      row,
      distance: groundingDistance(row, userProfile),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((s) => s.row);

  return scored;
}

function adjacentLevels(level: string): string[] {
  if (level === "beginner") return ["beginner", "intermediate"];
  if (level === "advanced") return ["advanced", "intermediate"];
  return ["intermediate", "beginner", "advanced"];
}

function groundingDistance(row: PlanTemplateRow, profile: UserProfile): number {
  let d = 0;
  if (row.primary_goal !== profile.goal) d += 3;
  if (row.difficulty_level !== profile.level) d += 2;
  if (row.target_gender && row.target_gender !== profile.gender) d += 5;
  return d;
}

/** Compact summary for Groq prompt — structure only, not full meal/exercise content. */
export function summarizeTemplateForPrompt(row: PlanTemplateRow): Record<string, unknown> {
  return {
    name: row.name,
    plan_type: row.plan_type,
    primary_goal: row.primary_goal,
    difficulty_level: row.difficulty_level,
    duration_weeks: row.duration_weeks,
    tags: row.tags,
    description: row.description?.slice(0, 200),
  };
}
