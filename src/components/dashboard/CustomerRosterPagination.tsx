"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  CUSTOMER_ROSTER_PAGE_SIZE_OPTIONS,
  customerRosterPageNumbers,
  type CustomerRosterPageSize,
} from "@/lib/customers/roster-pagination";
import { cn } from "@/lib/utils/cn";

type Props = {
  page: number;
  pageSize: CustomerRosterPageSize;
  total: number;
  totalPages: number;
  rangeFrom: number;
  rangeTo: number;
};

const footerBtnCn =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900";

/**
 * Table footer for `/dashboard/customers` — page size + page controls (Supabase-style).
 * URL: `?page=&limit=` (limit = 50 | 100 | 500).
 */
export function CustomerRosterPagination(props: Props) {
  const { page, pageSize, total, totalPages, rangeFrom, rangeTo } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value?.length) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      startTransition(() => {
        router.push(qs.length ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  const pageNums = customerRosterPageNumbers(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/40",
        pending && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rows per page</span>
        <select
          value={pageSize}
          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          onChange={(e) => {
            const nextSize = e.target.value;
            pushParams({ limit: nextSize === "50" ? undefined : nextSize, page: undefined });
          }}
        >
          {CUSTOMER_ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <p className="tabular-nums text-zinc-600 dark:text-zinc-400">
        {total === 0 ? "0 results" : `${rangeFrom}–${rangeTo} of ${total}`}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={footerBtnCn}
          aria-label="Previous page"
          disabled={!canPrev}
          onClick={() => pushParams({ page: page - 1 <= 1 ? undefined : String(page - 1) })}
        >
          <ChevronLeft className="size-4" />
        </button>

        {pageNums.map((n, idx) => {
          const prev = pageNums[idx - 1];
          const gap = prev != null && n - prev > 1;
          return (
            <span key={n} className="flex items-center gap-1">
              {gap ? <span className="px-1 text-zinc-400">…</span> : null}
              <button
                type="button"
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  footerBtnCn,
                  n === page &&
                    "border-orange-300 bg-orange-50 font-semibold text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
                )}
                onClick={() => pushParams({ page: n <= 1 ? undefined : String(n) })}
              >
                {n}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          className={footerBtnCn}
          aria-label="Next page"
          disabled={!canNext}
          onClick={() => pushParams({ page: String(page + 1) })}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
