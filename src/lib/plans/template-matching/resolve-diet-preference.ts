import { mapDietTypeTag } from "./diet-tags";
import type { UserProfile } from "./types";

/** Base diet slugs used for hard-filter matching (catalogue tags). */
export type BaseDietSlug = "vegetarian" | "non_vegetarian" | "vegan" | "no_restrictions";

export type ResolvedMemberDiet = {
  baseDiet: BaseDietSlug;
  /** True when member eats eggs (implicit for non-veg; explicit for vegetarian). */
  eatsEggs: boolean;
  /** Optional style: keto, intermittent_fasting, pescatarian — AND-filter on catalogue. */
  specialDiet: string | null;
  displayLabel: string;
};

function parseBooleanAnswer(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "yes" || value === "Yes") return true;
  if (value === false || value === "false" || value === "no" || value === "No") return false;
  return null;
}

function normalizeSpecialDiet(raw: unknown): string | null {
  if (raw == null) return null;
  const label = String(raw).trim();
  if (!label || label === "None" || label === "No Specific Diet") return null;
  return mapDietTypeTag(label) ?? label.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Resolve intake answers → stable matching profile.
 *
 * **Model:** Main diet = Vegetarian | Non-Vegetarian | Vegan (+ optional special style).
 * Vegetarians answer `eats_eggs` (yes → veg meals with anda; no → strict veg).
 * Non-vegetarians always include eggs/meat — no egg question shown.
 *
 * **Legacy:** `Eggetarian` intake → vegetarian + eatsEggs true.
 */
export function resolveMemberDiet(input: {
  dietType?: string | null;
  eatsEggs?: unknown;
  specialDiet?: unknown;
}): ResolvedMemberDiet {
  const rawType = input.dietType?.trim() ?? "";
  const legacyTag = mapDietTypeTag(rawType);

  let baseDiet: BaseDietSlug = "no_restrictions";
  let eatsEggs = false;
  let specialDiet = normalizeSpecialDiet(input.specialDiet);

  // Legacy top-level special diets → move to special_diet sub-question
  if (legacyTag === "keto" || legacyTag === "intermittent_fasting" || legacyTag === "pescatarian") {
    specialDiet = legacyTag;
    baseDiet = "no_restrictions";
  } else if (rawType === "Eggetarian" || legacyTag === "eggetarian") {
    baseDiet = "vegetarian";
    eatsEggs = true;
  } else if (legacyTag === "vegetarian") {
    baseDiet = "vegetarian";
    eatsEggs = parseBooleanAnswer(input.eatsEggs) ?? false;
  } else if (legacyTag === "non_vegetarian") {
    baseDiet = "non_vegetarian";
    eatsEggs = true;
  } else if (legacyTag === "vegan") {
    baseDiet = "vegan";
    eatsEggs = false;
  } else if (legacyTag === "no_restrictions" || !rawType) {
    baseDiet = "no_restrictions";
  }

  const parts: string[] = [];
  if (baseDiet !== "no_restrictions") parts.push(baseDiet.replace(/_/g, " "));
  if (baseDiet === "vegetarian" && eatsEggs) parts.push("(includes eggs)");
  if (specialDiet) parts.push(`+ ${specialDiet.replace(/_/g, " ")}`);

  return {
    baseDiet,
    eatsEggs,
    specialDiet,
    displayLabel: parts.length ? parts.join(" ") : "no specific diet",
  };
}

export function resolveMemberDietFromProfile(user: UserProfile): ResolvedMemberDiet {
  return resolveMemberDiet({
    dietType: user.dietPreference,
    eatsEggs: user.eatsEggs,
    specialDiet: user.specialDiet,
  });
}
