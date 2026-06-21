import type { PlanTemplateRow, UserProfile } from "./types";
import { resolveMemberDietFromProfile } from "./resolve-diet-preference";

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

function isSpecialDietCompatible(specialDiet: string, template: PlanTemplateRow): boolean {
  const templateDiet = inferTemplateDietType(template);
  if (templateDiet === specialDiet) return true;
  const tags = template.tags ?? [];
  return tags.includes(specialDiet);
}

function isBaseDietCompatible(
  baseDiet: "vegetarian" | "non_vegetarian" | "vegan",
  eatsEggs: boolean,
  template: PlanTemplateRow,
): boolean {
  const templateDiet = inferTemplateDietType(template);
  if (!templateDiet) return false;

  if (baseDiet === "vegan") {
    return templateDiet === "vegan";
  }

  if (baseDiet === "non_vegetarian") {
    return templateDiet === "non_vegetarian";
  }

  // Vegetarian base — egg preference refined in diet-meal-validation
  if (templateDiet === "vegan" || templateDiet === "non_vegetarian") return false;
  if (templateDiet === "eggetarian") return eatsEggs;
  if (templateDiet === "vegetarian") return true;

  return false;
}

/**
 * Hard filter for diet plans — goal/level/gender tier.
 * Uses resolved base diet + optional special style (keto, IF, pescatarian).
 */
export function filterByDietPreference(
  candidates: PlanTemplateRow[],
  userProfile: UserProfile,
): PlanTemplateRow[] {
  const resolved = resolveMemberDietFromProfile(userProfile);

  if (resolved.baseDiet === "no_restrictions" && !resolved.specialDiet) {
    return candidates;
  }

  let pool = candidates;

  if (resolved.specialDiet) {
    pool = pool.filter((template) => isSpecialDietCompatible(resolved.specialDiet!, template));
  }

  if (resolved.baseDiet !== "no_restrictions") {
    pool = pool.filter((template) =>
      isBaseDietCompatible(resolved.baseDiet as "vegetarian" | "non_vegetarian" | "vegan", resolved.eatsEggs, template),
    );
  }

  return pool;
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
