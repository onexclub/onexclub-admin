"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearDraft,
  draftStorageKey,
  isMeaningfulDraft,
  loadDraft,
  normalizeDraft,
  summarizeCustomerOnboardDraft,
  type CustomerOnboardDraft,
} from "@/lib/customers/customer-onboard-draft";
import { ROUTES } from "@/utils/routes";

type OutletOption = { id: string; name: string | null; city: string | null };

function outletLabel(o: OutletOption | undefined): string | undefined {
  if (!o?.name) return undefined;
  return o.city?.length ? `${o.name} · ${o.city}` : o.name;
}

/**
 * `/dashboard/customers?tab=drafts` — shows the staff member's explicitly saved onboard draft
 * (localStorage via {@link draftStorageKey}). “New customer” always opens a fresh wizard.
 */
export function CustomerOnboardDraftPanel(props: {
  actorProfileId: string;
  outlets: OutletOption[];
  defaultStartDate: string;
}) {
  const { actorProfileId, outlets, defaultStartDate } = props;
  const storageKey = draftStorageKey(actorProfileId);
  const defaultOutletId = outlets[0]?.id ?? "";

  const [draft, setDraft] = useState<CustomerOnboardDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    const raw = loadDraft(storageKey);
    const normalized = raw ? normalizeDraft(raw, defaultOutletId, defaultStartDate) : null;
    if (normalized?.savedAt && isMeaningfulDraft(normalized)) {
      setDraft(normalized);
    } else {
      setDraft(null);
    }
    setHydrated(true);
  }, [storageKey, defaultOutletId, defaultStartDate]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("onex-customer-draft-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("onex-customer-draft-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const handleDiscard = () => {
    clearDraft(storageKey);
    setDraft(null);
  };

  if (!hydrated) {
    return (
      <div className="px-4 py-14 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading drafts…</div>
    );
  }

  if (!draft) {
    return (
      <div className="px-4 py-14 text-center">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">No saved drafts</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use <span className="font-medium">Save as draft</span> in the add-customer wizard, or start a new member below.
        </p>
        <Link
          href={ROUTES.dashboardCustomerNew}
          className="mt-4 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          New customer
        </Link>
      </div>
    );
  }

  const outlet = outlets.find((o) => o.id === draft.membership.outletId);
  const summary = summarizeCustomerOnboardDraft(draft, outletLabel(outlet));

  return (
    <div className="p-4 sm:p-6">
      <article className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
              <FileText className="size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{summary.title}</h2>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{summary.subtitle}</p>
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <div>
                  <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">Step: </dt>
                  <dd className="inline">{summary.stepLabel}</dd>
                </div>
                {summary.savedAt ? (
                  <div>
                    <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">Saved: </dt>
                    <dd className="inline">{new Date(summary.savedAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {summary.isLinkingExisting ? (
                  <div>
                    <dd className="inline rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                      Existing member link
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleDiscard} className="gap-1.5">
              <Trash2 className="size-3.5" aria-hidden />
              Discard
            </Button>
            <Link
              href={ROUTES.dashboardCustomerNewResume}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-orange-600 px-3 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Play className="size-3.5" aria-hidden />
              Resume
            </Link>
          </div>
        </div>
      </article>
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Drafts are saved in this browser only. <Link href={ROUTES.dashboardCustomerNew} className="text-orange-600 hover:underline">New customer</Link> always starts blank.
      </p>
    </div>
  );
}
