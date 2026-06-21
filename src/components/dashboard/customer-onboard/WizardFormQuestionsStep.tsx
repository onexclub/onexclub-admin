"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { DynamicQuestionRenderer } from "@/features/onboarding/components/DynamicQuestionRenderer";
import { buildAnswersDefaultValues } from "@/features/onboarding/components/onboarding-defaults";
import { computeSectionCompletion } from "@/features/onboarding/completion";
import { SECTION_COPY } from "@/features/onboarding/constants";
import { useOnboardingDefinitions } from "@/features/onboarding/hooks/useOnboardingForms";
import { filterQuestionDefinitions } from "@/features/onboarding/question-visibility";
import type { OnboardingFormName, QuestionDefinition } from "@/features/onboarding/types";
import type { ProfileGender } from "@/lib/profile/vitals";
import { cn } from "@/lib/utils/cn";

/**
 * One wizard step = one `form_name` from `question_definitions`.
 *
 * **Moderation:** pass `headerSlot` on Basic Info for height/weight/BMI above DB questions.
 * Pass `memberGender` so gender-specific prompts from `visibility_json` are filtered out.
 */
export function WizardFormQuestionsStep(props: {
  outletId: string;
  formName: OnboardingFormName;
  answers: Record<string, unknown>;
  onSectionChange: (formName: OnboardingFormName, sectionAnswers: Record<string, unknown>) => void;
  /** From Identity step / profile — drives `question_definitions.visibility_json`. */
  memberGender?: ProfileGender | "" | null;
  headerSlot?: ReactNode;
  /** Highlight empty mandatory fields (after Continue / validation attempt). */
  highlightInvalid?: boolean;
  /** Hide completion counter — wizard uses field asterisks instead. */
  showCompletionSummary?: boolean;
}) {
  const { outletId, formName, answers, onSectionChange, memberGender, headerSlot, highlightInvalid = false, showCompletionSummary = true } = props;
  const { data: definitions, isPending, error } = useOnboardingDefinitions(outletId);
  const copy = SECTION_COPY[formName];
  /** Memoize — `.filter()` returns a new array every render and was resetting react-hook-form. */
  const defs = useMemo(
    () => filterQuestionDefinitions(definitions?.[formName] ?? [], { gender: memberGender }),
    [definitions, formName, memberGender],
  );

  if (error) {
    const msg = error instanceof Error ? error.message : "Unable to load intake questions.";
    return <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{msg}</p>;
  }

  if (isPending || !definitions) {
    return <p className="text-sm text-zinc-500">Loading questions…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-wide text-zinc-400">{formName}</p>
        <h2 className="sr-only">{copy.title}</h2>
      </div>

      {headerSlot}

      {!defs.length ? (
        <AutoCompleteEmptySection
          formName={formName}
          onSectionChange={onSectionChange}
        />
      ) : (
        <WizardFormQuestionsFields
          formName={formName}
          title={copy.title}
          description={copy.description}
          definitions={defs}
          initialAnswers={answers}
          onSectionChange={onSectionChange}
          highlightInvalid={highlightInvalid}
          showCompletionSummary={showCompletionSummary}
        />
      )}
    </div>
  );
}

/** Sections with zero applicable prompts (gender rules / empty config) still mark complete in draft. */
function AutoCompleteEmptySection(props: {
  formName: OnboardingFormName;
  onSectionChange: (formName: OnboardingFormName, sectionAnswers: Record<string, unknown>) => void;
}) {
  const { formName, onSectionChange } = props;
  useEffect(() => {
    onSectionChange(formName, {});
  }, [formName, onSectionChange]);

  return (
    <p className="rounded-xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-700">
      No questions apply for this member in this section — you can continue.
    </p>
  );
}

function WizardFormQuestionsFields(props: {
  formName: OnboardingFormName;
  title: string;
  description: string;
  definitions: QuestionDefinition[];
  initialAnswers: Record<string, unknown>;
  onSectionChange: (formName: OnboardingFormName, sectionAnswers: Record<string, unknown>) => void;
  highlightInvalid?: boolean;
  showCompletionSummary?: boolean;
}) {
  const { formName, title, description, definitions, initialAnswers, onSectionChange, highlightInvalid = false, showCompletionSummary = true } = props;
  const answersSignature = JSON.stringify(initialAnswers);
  const definitionsSignature = useMemo(
    () => definitions.map((d) => d.id).join(","),
    [definitions],
  );

  const defaultValues = useMemo(
    () => buildAnswersDefaultValues(definitions, initialAnswers),
    [definitions, answersSignature, definitionsSignature], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const form = useForm({
    defaultValues,
    mode: "onChange",
  });

  /** Skip reset when the parent draft was just updated by this form's watch handler. */
  const lastEmittedSignature = useRef<string | null>(null);

  useEffect(() => {
    const subscription = form.watch((values) => {
      const sig = JSON.stringify(values);
      lastEmittedSignature.current = sig;
      onSectionChange(formName, values as Record<string, unknown>);
    });
    return () => subscription.unsubscribe();
  }, [form, formName, onSectionChange]);

  /** Sync from parent draft / definition changes only — not on every local keystroke. */
  useEffect(() => {
    if (answersSignature === lastEmittedSignature.current) return;
    form.reset(defaultValues);
    lastEmittedSignature.current = answersSignature;
    onSectionChange(formName, defaultValues);
  }, [answersSignature, definitionsSignature, defaultValues, form, formName, onSectionChange]);

  const watched = useWatch({ control: form.control }) as Record<string, unknown>;
  const completion = useMemo(() => computeSectionCompletion(definitions, watched), [definitions, watched]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
        {showCompletionSummary ? (
          <>
            <p className="mt-2 text-xs text-zinc-500">
              Mandatory {completion.requiredAnswered}/{completion.requiredTotal} ({completion.percentRequired}%)
            </p>
            <div
              className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-valuenow={completion.percentRequired}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${title} mandatory completion`}
            >
              <div
                className={cn("h-full rounded-full bg-orange-600 transition-all duration-300 dark:bg-orange-500")}
                style={{ width: `${completion.percentRequired}%` }}
              />
            </div>
          </>
        ) : null}
      </div>
      <FormProvider {...form}>
        <div className="grid gap-6">
          {definitions.map((definition) => (
            <DynamicQuestionRenderer
              key={definition.id}
              definition={definition}
              disabled={false}
              highlightInvalid={highlightInvalid}
            />
          ))}
        </div>
      </FormProvider>
    </section>
  );
}
