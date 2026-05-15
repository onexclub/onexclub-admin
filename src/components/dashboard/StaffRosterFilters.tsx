"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { ASSIGNABLE_ROLES, ROLE_META, type UserRole } from "@/lib/auth/roles";
import { ROUTES } from "@/utils/routes";

type OutletOption = { id: string; name: string | null };

type Props = {
  outlets: OutletOption[];
  initialQ: string;
  initialOutlet: string;
  initialRole: string;
};

/**
 * Auto-applying search + filters for `/dashboard/staff`.
 *
 * **Reuse:** Same URL-driven pattern as `/dashboard/customers` (`?q=&outlet=&role=`) but selects
 * push immediately; search debounces ~350ms so typing stays smooth.
 */
export function StaffRosterFilters({ outlets, initialQ, initialOutlet, initialRole }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilters = Boolean(initialQ || initialOutlet || initialRole);

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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <span className="text-zinc-600 dark:text-zinc-400">Search by name</span>
          <input
            key={`q-${initialQ}`}
            defaultValue={initialQ}
            name="q"
            placeholder="Type a name…"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            onChange={(e) => {
              const value = e.target.value;
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                pushParams({ q: value.trim() || undefined });
              }, 350);
            }}
          />
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <span className="text-zinc-600 dark:text-zinc-400">Branch</span>
          <select
            value={initialOutlet}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            onChange={(e) => pushParams({ outlet: e.target.value || undefined })}
          >
            <option value="">All branches</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <span className="text-zinc-600 dark:text-zinc-400">Role</span>
          <select
            value={initialRole}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            onChange={(e) => pushParams({ role: e.target.value || undefined })}
          >
            <option value="">All roles</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r as UserRole].label}
              </option>
            ))}
          </select>
        </label>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => router.push(ROUTES.dashboardStaff)}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {hasFilters ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Filters apply automatically.
          {initialQ ? ` Name contains “${initialQ}”.` : null}
          {initialOutlet ? " Branch filtered." : null}
          {initialRole ? " Role filtered." : null}
        </p>
      ) : null}
    </div>
  );
}
