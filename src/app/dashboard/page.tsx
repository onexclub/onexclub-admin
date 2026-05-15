import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/utils/routes";

/** `/dashboard` home — mirrors `/admin/page.tsx`, but anchors new RBAC-safe routes (`ROUTES.dashboard*`). */

export default async function DashboardHomePage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = effectiveManagedOutletIds(ctx);

  let activeMembers = 0;
  let staffCount = 0;
  let outletName: string | null = null;
  type BranchRow = { id: string; name: string; city: string | null };
  let branches: BranchRow[] = [];

  if (outletIds.length) {
    const { data: outletRows } = await supabase
      .from("outlets")
      .select("id,name,city")
      .in("id", outletIds)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    branches = (outletRows ?? []) as BranchRow[];

    const primaryRow = branches.find((b) => b.id === ctx.primaryOutletId);
    outletName = primaryRow?.name ?? branches[0]?.name ?? null;

    const { count: memberCount } = await supabase
      .from("gym_memberships")
      .select("id", { count: "exact", head: true })
      .in("outlet_id", outletIds)
      .eq("status", "active")
      .is("deleted_at", null);
    activeMembers = memberCount ?? 0;

    const { count: sCount } = await supabase
      .from("staff_assignments")
      .select("id", { count: "exact", head: true })
      .in("outlet_id", outletIds)
      .is("revoked_at", null);
    staffCount = sCount ?? 0;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Branches"
          value={branches.length ? String(branches.length) : "—"}
          hint={branches.length <= 1 ? outletName ?? "Managed locations" : `${outletName ?? branches[0]?.name ?? "—"} + ${branches.length - 1} more`}
        />
        <StatCard label="Active members" value={activeMembers} hint="Across outlets you operate" />
        <StatCard label="Staff assignments" value={staffCount} hint="Seats counted per branch" />
      </section>

      {!outletIds.length ? (
        <EmptyState
          title="Waiting for outlet access"
          description='Platform teams link your profile via `staff_assignments`. Once granted, dashboards populate automatically.'
        />
      ) : (
        <div className="space-y-6">
          {branches.length > 1 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Your branches</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Addresses + HQ branding live under{" "}
                <Link href={ROUTES.dashboardBranches} className="font-medium text-orange-700 hover:underline dark:text-orange-400">
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
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Next steps</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                <li>
                  <Link className="text-orange-700 hover:underline dark:text-orange-400" href={ROUTES.dashboardCustomers}>
                    Review customers &amp; memberships
                  </Link>
                </li>
                <li>
                  <Link className="text-orange-700 hover:underline dark:text-orange-400" href={ROUTES.dashboardStaff}>
                    Invite staff roles
                  </Link>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">Security note</p>
              <p className="mt-2">
                Privileged Supabase calls stay on the server with the service role key. The browser never sees that secret — only JWT-scoped anon calls + server actions backed by audited guards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
