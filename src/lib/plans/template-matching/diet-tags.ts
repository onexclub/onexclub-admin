/** Map intake diet labels/slugs → tag slugs on plan_templates.tags (mirrors SQL map_diet_type_tag). */
export function mapDietTypeTag(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  // Normalize "Non-Vegetarian", "Non - Vegetarian", "non vegetarian" → non_vegetarian
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, "_");

  const map: Record<string, string> = {
    vegetarian: "vegetarian",
    non_vegetarian: "non_vegetarian",
    vegan: "vegan",
    eggetarian: "eggetarian",
    pescatarian: "pescatarian",
    keto: "keto",
    intermittent_fasting: "intermittent_fasting",
    high_protein: "high_protein",
    no_restrictions: "no_restrictions",
    no_specific_diet: "no_restrictions",
  };
  return map[normalized] ?? normalized;
}

/** Whether member chose a specific diet that requires exact template match. */
export function isSpecificDietPreference(label: string | null | undefined): boolean {
  const tag = mapDietTypeTag(label);
  return Boolean(tag && tag !== "no_restrictions");
}
