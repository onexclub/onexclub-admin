"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  buildGymDashboardChartModel,
  filterGymDashboardSnapshot,
  type GymDashboardBranchContext,
  type GymDashboardSnapshot,
} from "@/lib/admin/gym-dashboard-data";
import { GymDashboardCharts } from "@/components/admin/GymDashboardCharts";

type BranchOption = {
  id: string;
  name: string;
  city?: string | null;
};

type Props = {
  snapshot: GymDashboardSnapshot;
  branches: BranchOption[];
  branchContext: GymDashboardBranchContext;
  customersHref?: string;
  staffHref?: string;
};

/**
 * Branch-aware analytics shell for gym dashboard home.
 *
 * **Reuse:** pass the full `loadGymDashboardSnapshot` result from a Server Component.
 * - Single branch → auto-scopes to that location (no picker).
 * - Multi branch → "All branches" + per-branch tabs filter charts client-side.
 */
export function GymDashboardAnalyticsPanel({
  snapshot,
  branches,
  branchContext,
  customersHref,
  staffHref,
}: Props) {
  const { isMultiBranch, defaultBranchId } = branchContext;

  /** `all` = combined view; otherwise one outlet id. */
  const [scope, setScope] = useState<"all" | string>(() =>
    isMultiBranch ? "all" : (defaultBranchId ?? "all"),
  );

  const scopedSnapshot = useMemo(() => {
    if (!isMultiBranch) {
      const soleId = branches[0]?.id;
      return soleId ? filterGymDashboardSnapshot(snapshot, [soleId]) : snapshot;
    }
    if (scope === "all") return snapshot;
    return filterGymDashboardSnapshot(snapshot, [scope]);
  }, [snapshot, branches, isMultiBranch, scope]);

  const chartModel = useMemo(() => buildGymDashboardChartModel(scopedSnapshot), [scopedSnapshot]);

  const scopeLabel =
    !isMultiBranch
      ? (branches[0]?.name ?? "Your gym")
      : scope === "all"
        ? "All branches"
        : (branches.find((b) => b.id === scope)?.name ?? "Branch");

  const effectiveScopeMode: "single" | "multi" =
    isMultiBranch && scope === "all" ? "multi" : "single";

  return (
    <div className="space-y-4">
      {isMultiBranch ? (
        <div className="dashboard-rise flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Viewing</span>
          <div className="flex flex-wrap gap-2">
            <BranchScopeButton active={scope === "all"} onClick={() => setScope("all")}>
              All branches
            </BranchScopeButton>
            {branches.map((b) => (
              <BranchScopeButton key={b.id} active={scope === b.id} onClick={() => setScope(b.id)}>
                {b.name}
              </BranchScopeButton>
            ))}
          </div>
        </div>
      ) : null}

      <GymDashboardCharts
        {...chartModel}
        scopeMode={effectiveScopeMode}
        scopeLabel={scopeLabel}
        customersHref={customersHref}
        staffHref={staffHref}
      />
    </div>
  );
}

function BranchScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700"
          : "rounded-lg border border-zinc-600 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-orange-500/50 hover:text-zinc-100"
      }
    >
      {children}
    </button>
  );
}
