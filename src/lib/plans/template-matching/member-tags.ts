/** Intake sentinels that mean "no allergy / no restriction" — must not trigger safety holds. */
const NON_RESTRICTION_TOKENS = new Set([
  "none",
  "n/a",
  "na",
  "no",
  "no_allergies",
  "no_restrictions",
  "",
]);

/** Strip placeholder answers so "None" in food_allergies does not block AI diet assignment. */
export function sanitizeMemberTags(tags: string[]): string[] {
  return tags.filter((t) => !NON_RESTRICTION_TOKENS.has(t.trim().toLowerCase()));
}
