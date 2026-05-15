"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ONBOARDING_FORMS_IN_ORDER, SECTION_COPY } from "@/features/onboarding/constants";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { useOnboardingFormsBundle } from "@/features/onboarding/hooks/useOnboardingForms";

import { FormSectionCard } from "./FormSectionCard";

/** Client island — TanStack Query + RHF/Zod orchestration stays server-agnostic aside from anon Supabase reads/writes (RLS). */
export function OnboardingQuestionnairePanel(props: { viewer: OnboardingViewerContext; outletId: string | null }) {
  const { viewer, outletId } = props;

  const { mergedDefinitions, bundledResponses, error, isLoading } = useOnboardingFormsBundle(viewer.profileId, outletId);

  if (!outletId) {
    return <EmptyState title="Missing outlet" description="Membership must be pinned to an outlet before collecting intake forms." />;
  }

  if (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "Something went wrong while loading questionnaires.";
    return <EmptyState title="Forms unavailable" description={msg} />;
  }

  if (isLoading && !mergedDefinitions) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((slot) => (
          <div
            key={`skeleton-${slot}`}
            className="animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="mb-4 h-4 w-56 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-3/5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  const defsDict = mergedDefinitions ?? ({} as NonNullable<typeof mergedDefinitions>);
  const respDict = bundledResponses ?? {};

  return (
    <div className="space-y-5">
      {ONBOARDING_FORMS_IN_ORDER.map((formName, idx) => {
        const copy = SECTION_COPY[formName];
        return (
          <FormSectionCard
            key={formName}
            formName={formName}
            title={copy.title}
            description={copy.description}
            definitions={defsDict[formName] ?? []}
            bundledResponse={respDict[formName] ?? null}
            viewer={viewer}
            outletId={outletId}
            defaultOpen={idx === 0}
          />
        );
      })}
    </div>
  );
}
