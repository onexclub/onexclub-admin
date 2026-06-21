import type { PlanTemplateRow, UserProfile } from "./types";
import { sanitizeMemberTags } from "./member-tags";

/**
 * Hard filter: goal, level, gender are enforced upstream in SQL.
 * Here we exclude templates whose `constraints` intersect member injuries/allergies.
 */
export function filterByConstraints(
  candidates: PlanTemplateRow[],
  userProfile: UserProfile,
): PlanTemplateRow[] {
  const memberTags = new Set(
    sanitizeMemberTags([...userProfile.injuries, ...userProfile.allergies]).map((t) =>
      t.toLowerCase(),
    ),
  );
  if (memberTags.size === 0) return candidates;

  return candidates.filter((template) => {
    const templateConstraints = (template.constraints ?? []).map((c) => c.toLowerCase());
    if (templateConstraints.length === 0) return true;
    return !templateConstraints.some((c) => memberTags.has(c));
  });
}

/** True when member has real allergies/injuries requiring trainer review before trusting AI diet. */
export function requiresDietSafetyHold(userProfile: UserProfile): boolean {
  const tags = sanitizeMemberTags([...userProfile.injuries, ...userProfile.allergies]);
  return tags.length > 0;
}
