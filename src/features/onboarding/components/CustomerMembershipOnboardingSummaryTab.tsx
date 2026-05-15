"use client";

import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CompletionBadge } from "@/features/onboarding/components/CompletionBadge";
import { ONBOARDING_FORMS_IN_ORDER, SECTION_COPY, SECTION_SHORT_LABEL } from "@/features/onboarding/constants";
import { useOnboardingFormsBundle } from "@/features/onboarding/hooks/useOnboardingForms";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { dashboardCustomerOnboardingPath } from "@/utils/routes";

/** Adds the “Onboarding Forms” UX to `/dashboard/customers/[membershipId]` alongside overview actions. */
export function CustomerMembershipOnboardingSummaryTab(props: { viewer: OnboardingViewerContext; outletId: string | null }) {
  const { viewer, outletId } = props;
  const { bundledResponses: respDict, error, isLoading } = useOnboardingFormsBundle(
    viewer.profileId,
    outletId,
  );

  if (!outletId) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">No outlet pinned to render onboarding summaries.</p>;
  }

  if (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "Unable to load onboarding summaries.";
    return <p className="text-sm text-rose-600">{msg}</p>;
  }

  if (isLoading && !respDict) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading onboarding summaries…</p>;
  }

  const rows = respDict ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Multi-section questionnaires</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Tracks intake sections —{" "}
            <Link href={dashboardCustomerOnboardingPath(viewer.membershipId)} className="text-orange-600 hover:underline">
              open fullscreen editor
            </Link>
          </p>
        </div>
      </div>
      <Tabs defaultValue={ONBOARDING_FORMS_IN_ORDER[0]} className="w-full">
        <TabsList aria-label="Onboarding forms list" className="w-full sm:w-auto">
          {ONBOARDING_FORMS_IN_ORDER.map((form) => (
            <TabsTrigger key={form} value={form} className="flex-1 sm:flex-none">
              {SECTION_SHORT_LABEL[form]}
            </TabsTrigger>
          ))}
        </TabsList>

        {ONBOARDING_FORMS_IN_ORDER.map((form) => {
          const meta = SECTION_COPY[form];
          const row = rows[form];
          const incompleteWarn = row?.is_complete ? null : row ? "Incomplete — reopen to finalize." : "Not started.";

          return (
            <TabsContent key={`content-${form}`} value={form} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{meta.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{meta.description}</p>
                </div>
                <CompletionBadge isComplete={row?.is_complete ?? false} incompleteHint={incompleteWarn ?? undefined} />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Updated</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                    {row?.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Answered by</dt>
                  <dd className="mt-1 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {row?.answered_by ? row.answered_by.slice(0, 8) : "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Last editor</dt>
                  <dd className="mt-1 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {row?.last_edited_by ? row.last_edited_by.slice(0, 8) : "—"}
                  </dd>
                </div>
              </dl>
              {incompleteWarn ? <p className="text-xs text-amber-800 dark:text-amber-200">{incompleteWarn}</p> : null}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
