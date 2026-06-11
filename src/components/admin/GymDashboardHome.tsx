import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { GymDashboardAnalyticsPanel } from "@/components/admin/GymDashboardAnalyticsPanel";
import {
  buildGymDashboardChartModel,
  filterGymDashboardSnapshot,
  gymDashboardPageSubtitle,
  loadGymDashboardSnapshot,
  resolveGymDashboardBranchContext,
} from "@/lib/admin/gym-dashboard-data";

type BranchRow = { id: string; name: string; city: string | null };

type Props = {
  branchesManageHref: string;
  customersHref: string;
  staffHref: string;
};

/**
 * Shared gym dashboard home (`/dashboard` + legacy `/admin`).
 *
 * **Reuse:** both route entry pages render this component — branch-aware copy and analytics live here.
 */
export async function GymDashboardHome({ branchesManageHref, customersHref, staffHref }: Props) {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = effectiveManagedOutletIds(ctx);

  let activeMembers = 0;
  let staffCount = 0;
  type BranchRowLocal = BranchRow;
  let branches: BranchRowLocal[] = [];
  let snapshot: Awaited<ReturnType<typeof loadGymDashboardSnapshot>> | null = null;
  let branchContext = resolveGymDashboardBranchContext([], ctx.primaryOutletId);

  if (outletIds.length) {
    snapshot = await loadGymDashboardSnapshot(supabase, outletIds);

    const { data: outletRows } = await supabase
      .from("outlets")
      .select("id,name,city")
      .in("id", outletIds)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    branches = (outletRows ?? []) as BranchRowLocal[];

    branchContext = resolveGymDashboardBranchContext(branches, ctx.primaryOutletId);

    const scopedSnapshot = branchContext.isMultiBranch
      ? snapshot
      : branchContext.defaultBranchId
        ? filterGymDashboardSnapshot(snapshot, [branchContext.defaultBranchId])
        : snapshot;

    const chartModel = buildGymDashboardChartModel(scopedSnapshot);
    activeMembers = chartModel.report.activeMembers;
    staffCount = chartModel.report.staffCount;
  }

  const soleBranch = branches.length === 1 ? branches[0] : null;

  return (
    <div className="space-y-8">
      <div className="dashboard-rise">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Reports &amp; analytics</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {gymDashboardPageSubtitle(branches.length, branchContext.primaryBranchName)}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="dashboard-rise">
          {soleBranch ? (
            <StatCard
              label="Your branch"
              value={soleBranch.name}
              hint={soleBranch.city?.trim() || "Single location"}
            />
          ) : (
            <StatCard
              label="Branches"
              value={branches.length ? String(branches.length) : "—"}
              hint={
                branchContext.primaryBranchName
                  ? `${branchContext.primaryBranchName} + ${branches.length - 1} more`
                  : "Managed locations"
              }
            />
          )}
        </div>
        <div className="dashboard-rise dashboard-rise-delay-1">
          <StatCard
            label="Active members"
            value={activeMembers}
            hint={soleBranch ? "At this location" : "Across your branches"}
          />
        </div>
        <div className="dashboard-rise dashboard-rise-delay-2">
          <StatCard
            label="Staff"
            value={staffCount}
            hint={soleBranch ? "Team at this branch" : "Across your branches"}
          />
        </div>
      </section>

      {!outletIds.length ? (
        <EmptyState
          title="Waiting for outlet access"
          description="Your account needs a branch assignment before reports can load."
        />
      ) : (
        <div className="space-y-6">
          {branchContext.isMultiBranch ? (
            <div className="dashboard-rise rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Your branches</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Pick a branch above the charts, or manage addresses under{" "}
                <Link
                  href={branchesManageHref}
                  className="font-medium text-orange-700 hover:underline dark:text-orange-400"
                >
                  Branch management
                </Link>
                .
              </p>
              <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {branches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{b.name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{b.city?.trim() || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {snapshot ? (
            <GymDashboardAnalyticsPanel
              snapshot={snapshot}
              branches={branches}
              branchContext={branchContext}
              customersHref={customersHref}
              staffHref={staffHref}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
