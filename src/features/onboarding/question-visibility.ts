import type { ProfileGender } from "@/lib/profile/vitals";

import type { OnboardingFormName, QuestionDefinition, QuestionVisibilityRules } from "./types";

const GENDER_SET = new Set<string>(["male", "female", "other", "prefer_not_to_say"]);

/**
 * Member context used to decide which intake prompts apply.
 * Gender is collected on Identity (wizard step 0) or read from `profiles.gender`.
 */
export type MemberQuestionContext = {
  gender?: ProfileGender | "" | null;
};

/** Use when gender is unknown — gender-specific prompts stay hidden. */
export const EMPTY_MEMBER_QUESTION_CONTEXT: MemberQuestionContext = {};

/**
 * Parses `question_definitions.visibility_json` from Supabase.
 *
 * **Moderator examples (set in Supabase dashboard):**
 * - `null` or `{}` → show to everyone
 * - `{"genders":["female"]}` → pregnancy / menstrual / other female-only prompts
 * - `{"genders":["male"]}` → male-only prompts
 * - `{"genders":["male","female"]}` → both binary options; hides for `other` / `prefer_not_to_say`
 *
 * Also accepts legacy export key `visible_to_genders`.
 */
export function parseQuestionVisibility(raw: unknown): QuestionVisibilityRules | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const gendersRaw = rec.genders ?? rec.visible_to_genders;
  if (!Array.isArray(gendersRaw) || !gendersRaw.length) return null;

  const genders: ProfileGender[] = [];
  for (const item of gendersRaw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (GENDER_SET.has(trimmed)) {
      genders.push(trimmed as ProfileGender);
    }
  }

  return genders.length ? { genders } : null;
}

/** True when the question should render and count toward required completion for this member. */
export function isQuestionApplicable(def: QuestionDefinition, ctx: MemberQuestionContext): boolean {
  const allowed = def.visibility_json?.genders;
  if (!allowed?.length) return true;

  const gender = ctx.gender;
  if (!gender) {
    /** Gender-specific prompts stay hidden until identity is known. */
    return false;
  }

  return allowed.includes(gender);
}

export function filterQuestionDefinitions(
  defs: QuestionDefinition[],
  ctx: MemberQuestionContext,
): QuestionDefinition[] {
  return defs.filter((def) => isQuestionApplicable(def, ctx));
}

export function filterDefinitionBundleForMember(
  bundle: Record<OnboardingFormName, QuestionDefinition[]>,
  ctx: MemberQuestionContext,
): Record<OnboardingFormName, QuestionDefinition[]> {
  return {
    basic_info: filterQuestionDefinitions(bundle.basic_info ?? [], ctx),
    health_screening: filterQuestionDefinitions(bundle.health_screening ?? [], ctx),
    diet_preferences: filterQuestionDefinitions(bundle.diet_preferences ?? [], ctx),
  };
}
