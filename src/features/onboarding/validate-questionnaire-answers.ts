import { buildSectionAnswersSchema } from "./build-answers-schema";
import { ONBOARDING_FORMS_IN_ORDER } from "./constants";
import { buildAnswersDefaultValues } from "./components/onboarding-defaults";
import {
  EMPTY_MEMBER_QUESTION_CONTEXT,
  filterQuestionDefinitions,
  type MemberQuestionContext,
} from "./question-visibility";
import type { OnboardingFormName, QuestionDefinition } from "./types";

export function validateQuestionnaireSection(
  definitions: Record<OnboardingFormName, QuestionDefinition[]>,
  formName: OnboardingFormName,
  answers: Partial<Record<OnboardingFormName, Record<string, unknown>>>,
  memberContext?: MemberQuestionContext,
): boolean {
  const defs = filterQuestionDefinitions(definitions[formName] ?? [], memberContext ?? EMPTY_MEMBER_QUESTION_CONTEXT);
  if (!defs.length) return true;
  const values = buildAnswersDefaultValues(defs, answers[formName] ?? {});
  const schema = buildSectionAnswersSchema(defs, true);
  return schema.safeParse(values).success;
}

export function validateQuestionnaireAnswers(
  definitions: Record<OnboardingFormName, QuestionDefinition[]>,
  answers: Partial<Record<OnboardingFormName, Record<string, unknown>>>,
  memberContext?: MemberQuestionContext,
): { ok: true } | { ok: false; formName: OnboardingFormName } {
  for (const formName of ONBOARDING_FORMS_IN_ORDER) {
    const defs = filterQuestionDefinitions(definitions[formName] ?? [], memberContext ?? EMPTY_MEMBER_QUESTION_CONTEXT);
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
