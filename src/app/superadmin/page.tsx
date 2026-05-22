import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlatformDashboardCharts } from "@/components/superadmin/PlatformDashboardCharts";
import { ROUTES } from "@/utils/routes";
import {
  branchesForOrg,
  buildPlatformDashboardChartModel,
  loadPlatformOrgsAndBranches,
} from "@/lib/superadmin/platform-gyms-data";

export default async function SuperadminHomePage() {
  const supabase = await createServerSupabaseClient();

  const [{ count: orgCount }, { count: branchCount }, { count: memberCount }, tree] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("outlets").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("gym_memberships")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    loadPlatformOrgsAndBranches(supabase),
  ]);

  const { orgs, branches, memberCountByOutletId } = tree;
  const chartModel = buildPlatformDashboardChartModel(orgs, branches, memberCountByOutletId);

  const orgsWithNoBranches = orgs.filter((o) => branchesForOrg(o.id, branches).length === 0).length;
  const avgMembersPerBranch = branchCount ? (memberCount ?? 0) / branchCount : 0;
  const activeOrgs = orgs.filter((o) => o.is_active).length;

  return (
    <div className="space-y-8">
      <div className="dashboard-rise">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Platform dashboard</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Live view of gym brands, branches (<code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">outlets</code>
          ), and active memberships — with trends and distribution charts below.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="dashboard-rise">
          <StatCard label="Organizations" value={orgCount ?? 0} hint="Gym brands / tenants" />
        </div>
        <div className="dashboard-rise dashboard-rise-delay-1">
          <StatCard label="Branches" value={branchCount ?? 0} hint="Locations (outlets)" />
        </div>
        <div className="dashboard-rise dashboard-rise-delay-2">
          <StatCard label="Active memberships" value={memberCount ?? 0} hint="Across all branches" />
        </div>
      </section>

      <section className="dashboard-rise dashboard-rise-delay-3 flex flex-wrap gap-3">
        <Link
          href={ROUTES.superadminOnboard}
          className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 hover:shadow-md hover:shadow-orange-900/30"
        >
          + Onboard new gym
        </Link>
        <Link
          href={ROUTES.superadminGyms}
          className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          + Add branch to org
        </Link>
        <Link
          href={ROUTES.superadminCustomers}
          className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          All customers
        </Link>
        <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
          Onboarding creates an organization and its first branch. To add more branches, open{" "}
          <Link href={ROUTES.superadminGyms} className="font-medium text-orange-700 hover:underline dark:text-orange-400">
            All gyms
          </Link>{" "}
          and choose an organization.
        </p>
      </section>

      {!orgs.length ? (
        <EmptyState
          title="No gyms yet"
          description="Create your first organization and branch, then attach a gym admin."
          action={
            <Link
              href={ROUTES.superadminOnboard}
              className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Onboard new gym
            </Link>
          }
        />
      ) : (
        <PlatformDashboardCharts
          {...chartModel}
          report={{
            orgsWithNoBranches,
            avgMembersPerBranch,
            activeOrgs,
          }}
        />
      )}
    </div>
  );
}
