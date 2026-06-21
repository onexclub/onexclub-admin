import { mapDietTypeTag } from "./diet-tags";
import type { PlanTemplateRow, UserProfile } from "./types";

/** Diet slugs stored on `plan_templates.tags` — order matters for name parsing. */
const DIET_TYPE_TAGS = [
  "non_vegetarian",
  "vegetarian",
  "vegan",
  "eggetarian",
  "pescatarian",
  "keto",
  "intermittent_fasting",
] as const;

export type DietTypeSlug = (typeof DIET_TYPE_TAGS)[number] | "no_restrictions";

/**
 * Infer diet type from template tags + name.
 * Checks non-vegetarian BEFORE vegetarian to avoid substring false positives.
 */
export function inferTemplateDietType(template: PlanTemplateRow): DietTypeSlug | null {
  const tags = template.tags ?? [];
  for (const dietTag of DIET_TYPE_TAGS) {
    if (tags.includes(dietTag)) return dietTag;
  }

  const name = template.name.toLowerCase();
  if (/non[\s-]*veget/.test(name)) return "non_vegetarian";
  if (name.includes("vegan")) return "vegan";
  if (name.includes("eggetarian")) return "eggetarian";
  if (name.includes("pescatarian")) return "pescatarian";
  if (name.includes("keto")) return "keto";
  if (/intermittent[\s-]*fast/.test(name)) return "intermittent_fasting";
  if (name.includes("vegetarian")) return "vegetarian";

  return null;
}

/** Exact diet match required when member chose a specific diet (not "No Specific Diet"). */
export function isDietTypeCompatible(
  userDietTag: DietTypeSlug | null,
  template: PlanTemplateRow,
): boolean {
  if (!userDietTag || userDietTag === "no_restrictions") return true;

  const templateDiet = inferTemplateDietType(template);
  // Strict: untagged templates do not satisfy an explicit member diet preference
  if (!templateDiet) return false;

  return templateDiet === userDietTag;
}

/**
 * Hard filter for diet plans — same tier as goal/level/gender.
 * Prevents assigning Vegan/Vegetarian when member chose Non-Vegetarian.
 */
export function filterByDietPreference(
  candidates: PlanTemplateRow[],
  userProfile: UserProfile,
): PlanTemplateRow[] {
  if (userProfile.dietPreference == null) return candidates;

  const userTag = mapDietTypeTag(userProfile.dietPreference) as DietTypeSlug | null;
  if (!userTag || userTag === "no_restrictions") return candidates;

  return candidates.filter((template) => isDietTypeCompatible(userTag, template));
}

/** Count templates by inferred diet type — used in failure diagnostics. */
export function countByDietType(candidates: PlanTemplateRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of candidates) {
    const diet = inferTemplateDietType(row) ?? "untagged";
    counts[diet] = (counts[diet] ?? 0) + 1;
  }
  return counts;
}

export function formatDietLabel(tag: string | null | undefined): string {
  if (!tag) return "any";
  return tag.replace(/_/g, " ");
}
