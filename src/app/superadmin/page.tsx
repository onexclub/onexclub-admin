import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlatformGymsTree } from "@/components/superadmin/PlatformGymsTree";
import { ROUTES } from "@/utils/routes";
import { loadPlatformOrgsAndBranches } from "@/lib/superadmin/platform-gyms-data";

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Platform dashboard</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Onboarded gym brands (organizations) and their branches. Branches are stored as{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">outlets</code> in the database.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Organizations" value={orgCount ?? 0} hint="Gym brands / tenants" />
        <StatCard label="Branches" value={branchCount ?? 0} hint="Locations (outlets)" />
        <StatCard label="Active memberships" value={memberCount ?? 0} hint="Across all branches" />
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={ROUTES.superadminOnboard}
          className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          + Onboard new gym
        </Link>
        <Link
          href={ROUTES.superadminGyms}
          className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          + Add branch to org
        </Link>
        <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
          Onboarding creates an organization and its first branch. To add more branches, open{" "}
          <Link href={ROUTES.superadminGyms} className="font-medium text-orange-700 hover:underline dark:text-orange-400">
            All gyms
          </Link>{" "}
          and choose an organization.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Directory</h3>
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
          <PlatformGymsTree orgs={orgs} branches={branches} memberCountByOutletId={memberCountByOutletId} />
        )}
      </section>
    </div>
  );
}
