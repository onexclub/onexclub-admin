import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchMembershipPlansForOutlets,
} from "@/lib/admin/membership-plans-admin";
import type { DashboardFeature } from "@/lib/auth/roles";
import {
  MEMBERSHIP_CATALOG_EDITOR_ROLES,
  ROLES,
} from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { isAdminConsoleRole } from "@/types/roles";
import { ROUTES, dashboardCustomerMembershipPath } from "@/utils/routes";

const FEATURE: DashboardFeature = "customers";

type MembershipListItem = {
  id: string;
  status: string;
  outlet_id: string;
  profile_id: string;
  assigned_trainer_id: string | null;
  onboarded_by: string | null;
  joined_at: string | null;
  plan_id: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_paid: number | null;
  currency: string | null;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  outlet: { name: string | null; city: string | null } | null;
  plan: { id: string; name: string } | null;
};

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toMembershipListItem(raw: unknown): MembershipListItem {
  const r = raw as {
    id: string;
    status: string;
    outlet_id: string;
    profile_id: string;
    assigned_trainer_id?: string | null;
    onboarded_by: string | null;
    joined_at: string | null;
    plan_id: string | null;
    start_date: string | null;
    end_date: string | null;
    amount_paid: number | null;
    currency: string | null;
    profile:
      | { full_name: string | null; email: string | null; phone: string | null }
      | null
      | unknown[]
      | unknown[];
    outlet: { name: string | null; city: string | null } | null | unknown[];
    membership_plans: { id: string; name: string } | null | unknown[] | unknown;
  };
  return {
    id: r.id,
    status: r.status,
    outlet_id: r.outlet_id,
    profile_id: r.profile_id,
    assigned_trainer_id: r.assigned_trainer_id ?? null,
    onboarded_by: r.onboarded_by,
    joined_at: r.joined_at,
    plan_id: r.plan_id,
    start_date: r.start_date,
    end_date: r.end_date,
    amount_paid: r.amount_paid,
    currency: r.currency,
    profile: firstOrSelf(r.profile as never),
    outlet: firstOrSelf(r.outlet as never),
    plan: firstOrSelf(r.membership_plans as never),
  };
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    expired: "Expired",
    pending: "Pending",
  };
  return labels[status] ?? status;
}

/**
 * `/dashboard/customers` — server-side filters + row-level affordances follow `PERMISSIONS.customers`.
 *
 * **Trainer scope:** trainers only see memberships they’re assigned to (same filter as the membership query).
 */

export default async function DashboardCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; outlet?: string; plan?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = effectiveManagedOutletIds(ctx);
  const q = (sp.q ?? "").trim().toLowerCase();
  const outletFilter = (sp.outlet ?? "").trim();
  const planFilter = (sp.plan ?? "").trim();

  if (!outletIds.length) {
    return (
      <EmptyState
        title="No outlet scope"
        description="You need at least one managed branch before customer tooling unlocks."
      />
    );
  }

  const { rows: planRows } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds,
    includeInactive: false,
  });

  const { data: outletLookupRows } = await supabase
    .from("outlets")
    .select("id,name,city")
    .in("id", outletIds)
    .is("deleted_at", null);

  type OutletLite = { id: string; name: string | null; city: string | null };

  const outletOptions: OutletLite[] = (outletLookupRows ?? []) as OutletLite[];

  let query = supabase
    .from("gym_memberships")
    .select(
      "id,status,outlet_id,profile_id,assigned_trainer_id,onboarded_by,joined_at,plan_id,start_date,end_date,amount_paid,currency,profile:profiles!profile_id(full_name,email,phone),outlet:outlets(name,city),membership_plans(id,name)",
    )
    .in("outlet_id", outletIds)
    .is("deleted_at", null);

  if (ctx.appRole === ROLES.TRAINER && ctx.user) {
    query = query.eq("assigned_trainer_id", ctx.user.id);
  }

  if (outletFilter && outletIds.includes(outletFilter)) {
    query = query.eq("outlet_id", outletFilter);
  }

  if (planFilter.length) {
    query = query.eq("plan_id", planFilter);
  }

  query = query.order("joined_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return <EmptyState title="Unable to load memberships" description={error.message} />;
  }

  const membershipsRaw = data ?? [];

  let memberships = membershipsRaw.map(toMembershipListItem);

  if (q.length) {
    memberships = memberships.filter((row) => {
      const hay = `${row.profile?.full_name ?? ""} ${row.profile?.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const filtersForm = (
    <form method="GET" className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/60 md:grid-cols-5">
      <label className="flex flex-col gap-1 md:col-span-2">
        Search
        <input
          defaultValue={sp.q ?? ""}
          name="q"
          placeholder="Name or email"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1">
        Branch
        <select
          defaultValue={outletFilter}
          name="outlet"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All</option>
          {outletOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {[o.name, o.city].filter(Boolean).join(" · ") || o.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        Plan
        <select
          defaultValue={planFilter}
          name="plan"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All plans</option>
          {planRows.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="md:col-span-5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Apply filters
      </button>
    </form>
  );

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Customers</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Browse members by branch and plan. Open someone’s page to change their pass, assign a coach, or update contact details — what you can do depends on your role.
          </p>
          {isAdminConsoleRole(ctx.appRole) ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={ROUTES.dashboardCustomerOnboard}
                className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                Add customer
              </Link>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Creates Supabase Auth + membership, then every outlet questionnaire.
              </span>
            </div>
          ) : null}
        </div>

        {filtersForm}

        {!memberships.length ? (
          <EmptyState title="No matches" description="Loosen filters or onboard your first roster entry." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950/80">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Term</th>
                  <th className="px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {memberships.map((row) => {
                  const showPlans = MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctx.appRole as never);
                  const detailHref = dashboardCustomerMembershipPath(row.id);
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{row.profile?.full_name ?? "Unnamed"}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{row.profile?.email ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {row.outlet?.name ?? row.outlet_id}
                        {row.outlet?.city ? ` · ${row.outlet.city}` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.plan?.name ?? "—"}
                        {showPlans && row.plan_id ? (
                          <span className="mt-1 block font-mono text-[10px] text-zinc-500">{row.plan_id}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-800 dark:text-zinc-200">{statusLabel(row.status)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {row.start_date ?? "—"} → {row.end_date ?? "Open"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={detailHref}
                          className="inline-flex rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                          View profile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}