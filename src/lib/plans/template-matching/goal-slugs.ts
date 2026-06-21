/**
 * Mirrors SQL `normalize_fitness_goal_input` + `intake_fitness_goal_fallbacks` (migration 032).
 * **Reuse:** TS matching must use the same goal slugs as `pick_plan_template` in Postgres.
 */

const KNOWN_GOAL_SLUGS = new Set([
  "weight_loss",
  "muscle_gain",
  "general_fitness",
  "endurance",
  "flexibility",
  "athletic_performance",
  "rehabilitation",
  "improve_endurance",
  "increase_flexibility",
]);

const TITLE_CASE_GOALS: Record<string, string> = {
  "weight loss": "weight_loss",
  "muscle gain": "muscle_gain",
  "general fitness": "general_fitness",
  "improve endurance": "endurance",
  "increase flexibility": "flexibility",
  "athletic performance": "athletic_performance",
  rehabilitation: "rehabilitation",
};

/** Normalize intake fitness_goal label or slug. */
export function normalizeFitnessGoalInput(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const trimmed = label.trim();
  const slug = trimmed.toLowerCase().replace(/\s+/g, "_");
  if (KNOWN_GOAL_SLUGS.has(slug)) return slug;
  const titleKey = trimmed.toLowerCase();
  if (TITLE_CASE_GOALS[titleKey]) return TITLE_CASE_GOALS[titleKey];
  return slug;
}

/** Catalogue `primary_goal` slugs to query, best match first. */
export function intakeFitnessGoalFallbacks(label: string | null | undefined): string[] {
  const norm = normalizeFitnessGoalInput(label);
  switch (norm) {
    case "weight_loss":
      return ["weight_loss"];
    case "muscle_gain":
      return ["muscle_gain", "general_fitness"];
    case "athletic_performance":
      return ["muscle_gain", "general_fitness", "endurance"];
    case "endurance":
    case "improve_endurance":
      return ["endurance", "general_fitness"];
    case "flexibility":
    case "increase_flexibility":
      return ["flexibility", "general_fitness"];
    case "rehabilitation":
      return ["general_fitness", "flexibility"];
    case "general_fitness":
      return ["general_fitness", "muscle_gain"];
    default:
      return ["general_fitness"];
  }
}

/** Primary catalogue slug for AI inserts and diagnostics. */
export function catalogueGoalSlug(label: string | null | undefined): string {
  return intakeFitnessGoalFallbacks(label)[0] ?? normalizeFitnessGoalInput(label) ?? "general_fitness";
}
