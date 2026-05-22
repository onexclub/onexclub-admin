"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpDown, RotateCcw, RotateCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import { CUSTOMER_ROSTER_SORT_OPTIONS } from "@/lib/customers/roster-sort";
import { PROFILE_GENDER_OPTIONS } from "@/lib/profile/vitals";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/utils/routes";

type OutletOption = { id: string; name: string | null; city: string | null };

export const CUSTOMER_MEMBERSHIP_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
] as const;

type Props = {
  outlets: OutletOption[];
  plans: MembershipPlanAdminRow[];
  initialQ: string;
  initialOutlet: string;
  initialPlan: string;
  initialGender: string;
  initialStatus: string;
  initialSort: string;
};

const compactSelectCn =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const toolbarBtnCn =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900";

/**
 * Compact toolbar for `/dashboard/customers` — search + filter/sort menus in one row (Supabase-style).
 *
 * **Reuse:** mount inside the roster table card (`border-b` divider above `<table>`).
 * URL params: `?q=&outlet=&plan=&gender=&status=&sort=`
 */
export function CustomerRosterFilters({
  outlets,
  plans,
  initialQ,
  initialOutlet,
  initialPlan,
  initialGender,
  initialStatus,
  initialSort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterCount = [initialOutlet, initialPlan, initialGender, initialStatus].filter(Boolean).length;
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const hasFilters = Boolean(
    initialQ ||
      filterCount > 0 ||
      initialSort !== "joined_desc" ||
      (pageParam && pageParam !== "1") ||
      (limitParam && limitParam !== "50"),
  );

  const sortLabel =
    CUSTOMER_ROSTER_SORT_OPTIONS.find((o) => o.value === initialSort)?.label ?? "Date added (newest)";

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>, opts?: { resetPage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value?.length) next.set(key, value);
        else next.delete(key);
      }
      if (opts?.resetPage !== false) {
        next.delete("page");
      }
      const qs = next.toString();
      startTransition(() => {
        router.push(qs.length ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const resetAll = useCallback(() => {
    startTransition(() => {
      router.push(ROUTES.dashboardCustomers);
    });
  }, [router]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40",
        pending && "opacity-70",
      )}
    >
      <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 dark:border-zinc-700 dark:bg-zinc-950">
        <Search className="size-4 shrink-0 text-zinc-400" aria-hidden />
        <input
          key={`q-${initialQ}`}
          defaultValue={initialQ}
          name="q"
          placeholder="Search name, email, or phone"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          onChange={(e) => {
            const value = e.target.value;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              pushParams({ q: value.trim() || undefined });
            }, 350);
          }}
        />
        {initialQ ? (
          <button
            type="button"
            aria-label="Clear search"
            className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            onClick={() => pushParams({ q: undefined })}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div ref={filtersRef} className="relative">
        <button
          type="button"
          className={cn(
            toolbarBtnCn,
            filterCount > 0 &&
              "border-orange-300 bg-orange-50/80 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
          )}
          aria-expanded={filtersOpen}
          onClick={() => {
            setSortOpen(false);
            setFiltersOpen((v) => !v);
          }}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filters
          {filterCount > 0 ? (
            <span className="rounded-full bg-orange-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-orange-500">
              {filterCount}
            </span>
          ) : null}
        </button>

        {filtersOpen ? (
          <div className="absolute right-0 z-30 mt-1.5 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Refine list</p>
            <div className="space-y-2">
              <select
                value={initialOutlet}
                className={compactSelectCn}
                onChange={(e) => pushParams({ outlet: e.target.value || undefined })}
              >
                <option value="">All branches</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {[o.name, o.city].filter(Boolean).join(" · ") || o.id.slice(0, 8)}
                  </option>
                ))}
              </select>

              <select
                value={initialPlan}
                className={compactSelectCn}
                onChange={(e) => pushParams({ plan: e.target.value || undefined })}
              >
                <option value="">All plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={initialGender}
                className={compactSelectCn}
                onChange={(e) => pushParams({ gender: e.target.value || undefined })}
              >
                <option value="">All genders</option>
                {PROFILE_GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="unset">Not recorded</option>
              </select>

              <select
                value={initialStatus}
                className={compactSelectCn}
                onChange={(e) => pushParams({ status: e.target.value || undefined })}
              >
                <option value="">All statuses</option>
                {CUSTOMER_MEMBERSHIP_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {filterCount > 0 ? (
              <button
                type="button"
                className="mt-3 w-full rounded-md border border-zinc-200 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => {
                  pushParams({ outlet: undefined, plan: undefined, gender: undefined, status: undefined });
                  setFiltersOpen(false);
                }}
              >
                Reset filters
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="mt-3 w-full cursor-not-allowed rounded-md border border-dashed border-zinc-200 py-1.5 text-xs font-semibold text-zinc-400 dark:border-zinc-700"
              >
                No filters applied
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div ref={sortRef} className="relative">
        <button
          type="button"
          className={cn(
            toolbarBtnCn,
            initialSort !== "joined_desc" &&
              "border-orange-300 bg-orange-50/80 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
          )}
          aria-expanded={sortOpen}
          onClick={() => {
            setFiltersOpen(false);
            setSortOpen((v) => !v);
          }}
        >
          <ArrowUpDown className="size-3.5" aria-hidden />
          <span className="hidden max-w-[9rem] truncate sm:inline">{sortLabel}</span>
          <span className="sm:hidden">Sort</span>
        </button>

        {sortOpen ? (
          <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
            {CUSTOMER_ROSTER_SORT_OPTIONS.map((o) => {
              const active = o.value === initialSort;
              return (
                <button
                  key={o.value}
                  type="button"
                  className={cn(
                    "flex w-full rounded-md px-2.5 py-2 text-left text-sm transition",
                    active
                      ? "bg-orange-50 font-semibold text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900",
                  )}
                  onClick={() => {
                    pushParams({ sort: o.value === "joined_desc" ? undefined : o.value });
                    setSortOpen(false);
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={toolbarBtnCn}
        aria-label="Refresh list"
        title="Refresh"
        onClick={() => startTransition(() => router.refresh())}
      >
        <RotateCw className={cn("size-3.5", pending && "animate-spin")} aria-hidden />
      </button>

      <button
        type="button"
        className={cn(toolbarBtnCn, !hasFilters && "opacity-50")}
        aria-label="Reset search, filters, and sort"
        title="Reset all"
        disabled={!hasFilters}
        onClick={resetAll}
      >
        <RotateCcw className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}
