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

function normalizeVisibilityAnswer(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

/** Case-insensitive match for select answers (Vegetarian vs vegetarian). */
function answersMatch(expected: string, actual: unknown): boolean {
  const a = normalizeVisibilityAnswer(actual).toLowerCase();
  const e = normalizeVisibilityAnswer(expected).toLowerCase();
  return a.length > 0 && a === e;
}

function matchesShowWhen(
  rule: QuestionVisibilityRules["show_when"],
  sectionAnswers?: Record<string, unknown>,
): boolean {
  if (!rule?.values?.length) return true;
  const raw = sectionAnswers?.[rule.question_key];
  if (raw == null || (typeof raw === "string" && !raw.trim())) return false;
  return rule.values.some((v) => answersMatch(v, raw));
}

/**
 * Parses `question_definitions.visibility_json` from Supabase.
 *
 * **Moderator examples (set in Supabase dashboard):**
 * - `null` or `{}` → show to everyone
 * - `{"genders":["female"]}` → pregnancy / menstrual / other female-only prompts
 * - `{"show_when":{"question_key":"diet_type","values":["Vegetarian"]}}` → eats_eggs follow-up
 *
 * Also accepts legacy export key `visible_to_genders`.
 */
export function parseQuestionVisibility(raw: unknown): QuestionVisibilityRules | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;

  const gendersRaw = rec.genders ?? rec.visible_to_genders;
  const genders: ProfileGender[] = [];
  if (Array.isArray(gendersRaw)) {
    for (const item of gendersRaw) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (GENDER_SET.has(trimmed)) {
        genders.push(trimmed as ProfileGender);
      }
    }
  }

  let show_when: QuestionVisibilityRules["show_when"];
  const showWhenRaw = rec.show_when;
  if (showWhenRaw && typeof showWhenRaw === "object" && !Array.isArray(showWhenRaw)) {
    const sw = showWhenRaw as Record<string, unknown>;
    const key = typeof sw.question_key === "string" ? sw.question_key : "";
    const valuesRaw = sw.values;
    const values = Array.isArray(valuesRaw)
      ? valuesRaw.filter((v): v is string => typeof v === "string")
      : [];
    if (key && values.length) {
      show_when = { question_key: key, values };
    }
  }

  if (!genders.length && !show_when) return null;
  return { ...(genders.length ? { genders } : {}), ...(show_when ? { show_when } : {}) };
}

/** True when the question should render and count toward required completion for this member. */
export function filterQuestionDefinitions(
  defs: QuestionDefinition[],
  ctx: MemberQuestionContext,
  sectionAnswers?: Record<string, unknown>,
  options?: { applyShowWhen?: boolean },
): QuestionDefinition[] {
  const applyShowWhen = options?.applyShowWhen ?? sectionAnswers !== undefined;

  return defs.filter((def) => {
    const allowed = def.visibility_json?.genders;
    if (allowed?.length) {
      const gender = ctx.gender;
      if (!gender) return false;
      if (!allowed.includes(gender)) return false;
    }

    if (def.visibility_json?.show_when) {
      if (!applyShowWhen) return true;
      return matchesShowWhen(def.visibility_json.show_when, sectionAnswers);
    }

    return true;
  });
}

export function filterDefinitionBundleForMember(
  bundle: Record<OnboardingFormName, QuestionDefinition[]>,
  ctx: MemberQuestionContext,
  answers?: Partial<Record<OnboardingFormName, Record<string, unknown>>>,
): Record<OnboardingFormName, QuestionDefinition[]> {
  return {
    basic_info: filterQuestionDefinitions(bundle.basic_info ?? [], ctx, answers?.basic_info),
    health_screening: filterQuestionDefinitions(
      bundle.health_screening ?? [],
      ctx,
      answers?.health_screening,
    ),
    diet_preferences: filterQuestionDefinitions(
      bundle.diet_preferences ?? [],
      ctx,
      answers?.diet_preferences,
    ),
  };
}
