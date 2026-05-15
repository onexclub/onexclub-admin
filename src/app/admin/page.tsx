import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/utils/routes";

export default async function AdminHomePage() {
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
        <StatCard label="Active members" value={activeMembers} hint="Across managed outlets" />
        <StatCard label="Staff seats" value={staffCount} hint="Assignments on managed outlets (all roles)" />
      </section>

      {!outletIds.length ? (
        <EmptyState
          title="No outlet assigned"
          description="Ask a platform superadmin to add your profile to `staff_assignments` for an outlet — any gym staff role (`gym_owner`, `branch_admin`, `receptionist`, `trainer`) links you to that location."
        />
      ) : (
        <div className="space-y-6">
          {branches.length > 1 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Your branches</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Locations tied to your gym account (same organization). Full addresses are on{" "}
                <Link href={ROUTES.adminOrganization} className="font-medium text-orange-700 hover:underline dark:text-orange-400">
                  Gym profile
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
                <Link className="text-orange-700 hover:underline dark:text-orange-400" href={ROUTES.dashboardCustomerOnboard}>
                  Add customers
                </Link>{" "}
                with email + temporary password (swap for invites in production).
              </li>
              <li>
                <Link className="text-orange-700 hover:underline dark:text-orange-400" href={`${ROUTES.admin}/staff`}>
                  Invite staff
                </Link>{" "}
                for day-to-day operations.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Security note</p>
            <p className="mt-2">
              Member creation uses a server-only service role after verifying you manage the target outlet. Never ship the
              service role key to the browser bundle.
            </p>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
