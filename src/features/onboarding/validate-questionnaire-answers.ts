import { buildSectionAnswersSchema } from "./build-answers-schema";
import { ONBOARDING_FORMS_IN_ORDER } from "./constants";
import { buildAnswersDefaultValues } from "./components/onboarding-defaults";
import type { OnboardingFormName, QuestionDefinition } from "./types";

export function validateQuestionnaireSection(
  definitions: Record<OnboardingFormName, QuestionDefinition[]>,
  formName: OnboardingFormName,
  answers: Partial<Record<OnboardingFormName, Record<string, unknown>>>,
): boolean {
  const defs = definitions[formName] ?? [];
  if (!defs.length) return true;
  const values = buildAnswersDefaultValues(defs, answers[formName] ?? {});
  const schema = buildSectionAnswersSchema(defs, true);
  return schema.safeParse(values).success;
}

export function validateQuestionnaireAnswers(
  definitions: Record<OnboardingFormName, QuestionDefinition[]>,
  answers: Partial<Record<OnboardingFormName, Record<string, unknown>>>,
): { ok: true } | { ok: false; formName: OnboardingFormName } {
  for (const formName of ONBOARDING_FORMS_IN_ORDER) {
    const defs = definitions[formName] ?? [];
    if (!defs.length) continue;
    const values = buildAnswersDefaultValues(defs, answers[formName] ?? {});
    const schema = buildSectionAnswersSchema(defs, true);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      return { ok: false, formName };
    }
  }
  return { ok: true };
}
