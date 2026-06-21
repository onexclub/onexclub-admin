import { mapDietTypeTag } from "./diet-tags";
import type { PlanTemplateRow, UserProfile } from "./types";

/**
 * Soft scoring — tiebreaker ONLY among templates that already passed hard filters.
 * Never scores goal, level, or gender (those are exact-match predicates).
 */
export function scoreTemplateSoft(
  template: PlanTemplateRow,
  userProfile: UserProfile,
  preferOutletSpecific: boolean,
): number {
  let score = 0;

  if (preferOutletSpecific && template.outlet_id === userProfile.outletId) score += 50;
  else if (template.outlet_id == null) score += 10;

  if (userProfile.goalFallbacks?.length && template.primary_goal) {
    const idx = userProfile.goalFallbacks.indexOf(template.primary_goal);
    if (idx === 0) score += 25;
    else if (idx > 0) score += 8;
  }

  if (userProfile.dietPreference && template.plan_type === "diet") {
    const dietTag = mapDietTypeTag(userProfile.dietPreference);
    if (dietTag && template.tags?.includes(dietTag)) score += 40;
  }

  if (
    userProfile.age != null &&
    template.min_age != null &&
    template.max_age != null &&
    userProfile.age >= template.min_age &&
    userProfile.age <= template.max_age
  ) {
    score += 20;
  }

  if (
    userProfile.bmi != null &&
    template.min_bmi != null &&
    template.max_bmi != null &&
    userProfile.bmi >= Number(template.min_bmi) &&
    userProfile.bmi <= Number(template.max_bmi)
  ) {
    score += 15;
  }

  if (userProfile.intakeScore != null) {
    const mid = (template.min_score + template.max_score) / 2;
    const distance = Math.abs(userProfile.intakeScore - mid);
    score += Math.max(0, 30 - distance);
  }

  if (template.plan_type === "exercise" && userProfile.equipment?.length) {
    const equipTags = (template.tags ?? []).filter((t) => t.startsWith("equip_"));
    const overlap = userProfile.equipment.filter((e) =>
      equipTags.some((tag) => tag.includes(e.replace(/\s+/g, "_"))),
    );
    score += overlap.length * 5;
  }

  score += Math.min(template.match_count ?? 0, 20);

  return score;
}

function rankBySoftScore(candidates: PlanTemplateRow[], userProfile: UserProfile): PlanTemplateRow[] {
  return [...candidates].sort((a, b) => {
    const diff =
      scoreTemplateSoft(b, userProfile, true) - scoreTemplateSoft(a, userProfile, true);
    if (diff !== 0) return diff;
    return (b.match_count ?? 0) - (a.match_count ?? 0);
  });
}

export function pickBestBySoftScore(
  candidates: PlanTemplateRow[],
  userProfile: UserProfile,
): PlanTemplateRow | null {
  if (!candidates.length) return null;
  return rankBySoftScore(candidates, userProfile)[0] ?? null;
}

/** Rank all candidates for Groq validation retries (top N). */
export function rankCandidatesBySoftScore(
  candidates: PlanTemplateRow[],
  userProfile: UserProfile,
  limit = 5,
): PlanTemplateRow[] {
  return rankBySoftScore(candidates, userProfile).slice(0, limit);
}
