"use client";

import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { buildSectionAnswersSchema } from "@/features/onboarding/build-answers-schema";
import { computeSectionCompletion } from "@/features/onboarding/completion";
import { useUpsertOnboardingSectionMutation } from "@/features/onboarding/hooks/useOnboardingForms";
import { canEditOnboardingSection, canViewOnboardingSection } from "@/features/onboarding/permissions";
import type { OnboardingFormName, OnboardingViewerContext, QuestionDefinition, QuestionsResponseRow } from "@/features/onboarding/types";

import { cn } from "@/lib/utils/cn";

import { CompletionBadge } from "./CompletionBadge";
import { DynamicQuestionRenderer } from "./DynamicQuestionRenderer";
import { buildAnswersDefaultValues } from "./onboarding-defaults";

export function FormSectionCard(props: {
  formName: OnboardingFormName;
  title: string;
  description: string;
  definitions: QuestionDefinition[];
  viewer: OnboardingViewerContext;
  bundledResponse?: QuestionsResponseRow | null;
  outletId: string | null;
  defaultOpen?: boolean;
}) {
  const { formName, title, description, definitions, viewer, bundledResponse, outletId, defaultOpen } = props;
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [serverError, setServerError] = useState<string | null>(null);
  const canView = canViewOnboardingSection(viewer.role, formName);
  const sectionEditable = canEditOnboardingSection(viewer.role, formName);
  const sectionRoleLocked = !sectionEditable;

  const parsedExisting = bundledResponse?.answers_json ?? {};
  const answersSignature = JSON.stringify(parsedExisting);

  const defaultValues = useMemo(() => buildAnswersDefaultValues(definitions, parsedExisting), [definitions, answersSignature]); // eslint-disable-line react-hooks/exhaustive-deps -- signature tracks JSON payload

  const form = useForm({
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues]); // eslint-disable-line react-hooks/exhaustive-deps -- `useForm()` instance is stable

  const watched = useWatch({
    control: form.control,
  }) as Record<string, unknown>;

  const completion = useMemo(() => computeSectionCompletion(definitions, watched), [definitions, watched]);
  const upsertMutation = useUpsertOnboardingSectionMutation(viewer.profileId, outletId);

  if (!canView) {
    return null;
  }

  if (definitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No published questions configured for this section yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const serializeErrors = (finalize: boolean) => {
    const schema = buildSectionAnswersSchema(definitions, finalize);
    const parsed = schema.safeParse(form.getValues());
    if (parsed.success) return { ok: true as const, data: parsed.data as Record<string, unknown> };

    for (const issue of parsed.error.issues) {
      const pathRoot = Array.isArray(issue.path) && issue.path.length > 0 ? String(issue.path[0]) : undefined;
      if (!pathRoot) continue;
      form.setError(pathRoot as never, { type: "manual", message: issue.message ?? "Invalid value" });
    }
    return { ok: false as const };
  };

  const handleSaveDraft = async () => {
    setServerError(null);
    clearExternalErrors(form);
    const parsed = serializeErrors(false);
    if (!parsed.ok) return;
    await submitPayload(false, parsed.data);
  };

  const handleFinalize = async () => {
    setServerError(null);
    clearExternalErrors(form);
    const parsed = serializeErrors(true);
    if (!parsed.ok) return;
    await submitPayload(true, parsed.data);
  };

  const submitPayload = async (finalize: boolean, answers: Record<string, unknown>) => {
    try {
      await upsertMutation.mutateAsync({
        formName,
        answers,
        finalize,
        actorProfileId: viewer.actorProfileId ?? null,
        previous: bundledResponse ?? null,
      });
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Unable to save right now.");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CompletionBadge isComplete={bundledResponse?.is_complete ?? false} />
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              <dl className="flex flex-wrap gap-3 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-zinc-400">Completion</dt>
                  <dd className="text-sm font-semibold normal-case tracking-normal text-zinc-900 dark:text-zinc-100">
                    Required {completion.requiredAnswered}/{completion.requiredTotal}{" "}
                    <span className="font-normal text-zinc-600 dark:text-zinc-300">({completion.percentRequired}%)</span>
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-zinc-400">Optional prompts</dt>
                  <dd className="text-sm font-semibold normal-case tracking-normal text-zinc-900 dark:text-zinc-100">
                    {completion.optionalAnswered}/{completion.optionalTotal}
                  </dd>
                </div>
              </dl>
              {bundledResponse?.updated_at ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Last synced {new Date(bundledResponse.updated_at).toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No saved draft yet for this membership.</p>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-expanded={open}
                className="inline-flex h-11 min-w-[132px] items-center justify-between gap-3 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                {open ? "Collapse" : "Expand"}
                <ChevronSvg className={cn("size-5 transition-transform", open && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5">
            {serverError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
                {serverError}
              </p>
            ) : null}
            <FormProvider {...form}>
              <div className="grid gap-6">
                {definitions.map((definition) => {
                  const fieldDisabled =
                    sectionRoleLocked || (viewer.isCustomerActor && !definition.editable_by_customer);
                  return (
                    <DynamicQuestionRenderer key={definition.id} definition={definition} disabled={fieldDisabled} />
                  );
                })}
              </div>
            </FormProvider>
            {sectionRoleLocked ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This section is read-only for your role; ask a branch lead or coach for updates.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button type="button" variant="secondary" disabled={upsertMutation.isPending} onClick={handleSaveDraft}>
                  {upsertMutation.isPending ? "Saving…" : "Save draft"}
                </Button>
                <Button type="button" disabled={upsertMutation.isPending} onClick={handleFinalize}>
                  {upsertMutation.isPending ? "Submitting…" : "Submit final"}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function clearExternalErrors(form: ReturnType<typeof useForm>) {
  const keys = Object.keys(form.getValues());
  for (const key of keys) {
    form.clearErrors(key as never);
  }
}

function ChevronSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
