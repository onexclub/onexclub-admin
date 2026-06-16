"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ACTIVE_BRANCH_ALL } from "@/lib/auth/active-branch-constants";
import { setActiveBranchFormAction } from "@/app/auth/choose-branch/actions";
import type { DashboardShellTheme } from "@/components/layout/SidebarNav";
import type { ActiveBranchScope } from "@/lib/auth/active-branch-session";

export type ActiveBranchSwitcherOption = {
  id: string;
  name: string;
  city: string | null;
};

function branchLabel(b: ActiveBranchSwitcherOption): string {
  return b.city?.trim() ? `${b.name} · ${b.city.trim()}` : b.name;
}

function BranchSelect({
  branches,
  activeOutletId,
  scope,
  shellTheme,
}: {
  branches: ActiveBranchSwitcherOption[];
  activeOutletId: string | null;
  scope: ActiveBranchScope;
  shellTheme: DashboardShellTheme;
}) {
  const { pending } = useFormStatus();

  const selectClass =
    shellTheme === "superadmin"
      ? "max-w-[min(100%,14rem)] truncate rounded-lg border border-zinc-700 bg-zinc-900/60 py-1.5 pl-2.5 pr-8 text-sm text-zinc-100 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-2 disabled:opacity-60"
      : "max-w-[min(100%,14rem)] truncate rounded-lg border border-zinc-200 bg-white py-1.5 pl-2.5 pr-8 text-sm text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-2 disabled:opacity-60";

  const value = scope === "all" ? ACTIVE_BRANCH_ALL : (activeOutletId ?? ACTIVE_BRANCH_ALL);

  return (
    <>
      <label className="sr-only" htmlFor="active-branch-switcher">
        Active branch
      </label>
      <select
        id="active-branch-switcher"
        name="outlet_id"
        value={value}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={selectClass}
        title="Switch branch"
      >
        <option value={ACTIVE_BRANCH_ALL}>All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {branchLabel(b)}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * Header branch switcher — writes the same cookie as post-login {@link ChooseBranchPanel}.
 *
 * **Reuse:** pass `branches` + session fields from `dashboard/layout.tsx`
 * (`resolveActiveBranchSession` + `loadManagedOutletsForAdmin`).
 */
export function ActiveBranchSwitcher({
  branches,
  activeOutletId,
  scope,
  shellTheme,
}: {
  branches: ActiveBranchSwitcherOption[];
  activeOutletId: string | null;
  scope: ActiveBranchScope;
  shellTheme: DashboardShellTheme;
}) {
  const pathname = usePathname();

  if (branches.length <= 1) return null;

  return (
    <form action={setActiveBranchFormAction}>
      <input type="hidden" name="next" value={pathname} />
      <BranchSelect
        branches={branches}
        activeOutletId={activeOutletId}
        scope={scope}
        shellTheme={shellTheme}
      />
    </form>
  );
}
