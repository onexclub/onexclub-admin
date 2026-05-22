"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  draftStorageKey,
  isMeaningfulDraft,
  loadDraft,
  normalizeDraft,
} from "@/lib/customers/customer-onboard-draft";
import { todayUtcIsoDate } from "@/lib/date-term";

export type CustomerCustomersTab = "members" | "drafts";

function buildTabHref(pathname: string, searchParams: URLSearchParams, tab: CustomerCustomersTab): string {
  const params = new URLSearchParams(searchParams.toString());
  if (tab === "members") {
    params.delete("tab");
  } else {
    params.set("tab", tab);
  }
  params.delete("page");
  const q = params.toString();
  return q.length ? `${pathname}?${q}` : pathname;
}

function countSavedDraft(actorProfileId: string, defaultOutletId: string): number {
  const raw = loadDraft(draftStorageKey(actorProfileId));
  if (!raw) return 0;
  const draft = normalizeDraft(raw, defaultOutletId, todayUtcIsoDate());
  return draft.savedAt && isMeaningfulDraft(draft) ? 1 : 0;
}

/** Members | Drafts tabs for `/dashboard/customers` (draft badge = 0 or 1). */
export function CustomerCustomersViewTabs(props: {
  actorProfileId: string;
  defaultOutletId: string;
}) {
  const { actorProfileId, defaultOutletId } = props;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const active: CustomerCustomersTab = tabParam === "drafts" ? "drafts" : "members";

  const [draftCount, setDraftCount] = useState(0);

  const refreshCount = useCallback(() => {
    setDraftCount(countSavedDraft(actorProfileId, defaultOutletId));
  }, [actorProfileId, defaultOutletId]);

  useEffect(() => {
    refreshCount();
    const onChange = () => refreshCount();
    window.addEventListener("onex-customer-draft-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("onex-customer-draft-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refreshCount]);

  const tabs: { id: CustomerCustomersTab; label: string; badge?: number }[] = [
    { id: "members", label: "Members" },
    { id: "drafts", label: "Drafts", badge: draftCount > 0 ? draftCount : undefined },
  ];

  return (
    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-900/60">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={buildTabHref(pathname, searchParams, t.id)}
            className={cn(
              "relative rounded-lg px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {t.label}
            {t.badge != null && t.badge > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                {t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
