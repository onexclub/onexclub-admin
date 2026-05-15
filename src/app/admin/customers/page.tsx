import Link from "next/link";
import { MembershipAssignPlanPanel } from "@/components/admin/MembershipAssignPlanPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayUtcIsoDate } from "@/lib/date-term";
import {
  fetchMembershipPlansForOutlets,
  type MembershipPlanAdminRow,
} from "@/lib/admin/membership-plans-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { isAdminConsoleRole } from "@/types/roles";
import { ROUTES, adminCustomerOnboardingPath } from "@/utils/routes";

/** Normalized embed helper — PostgREST can return `{}`/`[]` inconsistently depending on FK metadata. */
type MembershipListItem = {
  id: string;
  status: string;
  outlet_id: string;
  profile_id: string;
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

/**
 * Admin-facing customer list + renewal controls.
 *
 * Data loading pattern:
 * - Resolve managed outlets from `getAuthDashboardContext`.
 * - Read `membership_plans` with `fetchMembershipPlansForOutlets` (reuse with onboarding/plans editors).
 */
export default async function AdminCustomersPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = effectiveManagedOutletIds(ctx);

  if (!outletIds.length) {
    return (
      <EmptyState
        title="No managed outlets"
        description="You need at least one outlet in your dashboard scope. Ask for a `staff_assignments` row on a branch (any staff role); gym owners automatically include every outlet in the same organization."
      />
    );
  }

  const { rows: planRows } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds,
    includeInactive: false,
  });

  const { data, error } = await supabase
    .from("gym_memberships")
    .select(
      "id,status,outlet_id,profile_id,onboarded_by,joined_at,plan_id,start_date,end_date,amount_paid,currency,profile:profiles!profile_id(full_name,email,phone),outlet:outlets(name,city),membership_plans(id,name)",
    )
    .in("outlet_id", outletIds)
    .is("deleted_at", null)
    .order("joined_at", { ascending: false });

  if (error) {
    return (
      <EmptyState
        title="Unable to load customers"
        description={error.message || "Something went wrong while loading gym memberships."}
      />
    );
  }

  const memberships = (data ?? []).map(toMembershipListItem);
  const onboardedByMe = memberships.filter((m) => m.onboarded_by === ctx.user?.id);
  const linkedCustomers = memberships.length;
  const isoToday = todayUtcIsoDate();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Customers</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Inspect membership rows for your gyms, intake questionnaires per member, then expand &ldquo;Plan tools&rdquo; to activate or renew
              catalogue SKUs after offline payments settle.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {isAdminConsoleRole(ctx.appRole) ? (
              <Link
                href={ROUTES.dashboardCustomerOnboard}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Add customer
              </Link>
            ) : (
              <p className="max-w-[16rem] text-right text-xs text-zinc-500 dark:text-zinc-400">
                New member signup (Supabase Auth) is restricted to gym owners and branch admins. Use intake questionnaires for existing rows below.
              </p>
            )}
            <Link
              href={ROUTES.dashboardCustomers}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Open gym dashboard list
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Linked to your gym(s)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{linkedCustomers}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Onboarded by you</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{onboardedByMe.length}</p>
          </div>
        </div>
      </div>

      {!memberships.length ? (
        <EmptyState
          title="No customers found"
          description="No customer memberships are linked to your managed outlets yet."
          action={
            isAdminConsoleRole(ctx.appRole) ? (
            <Link
              href={ROUTES.dashboardCustomerOnboard}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Add first customer
            </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-950/40">
              <tr>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Customer</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Outlet</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Status</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Plan snapshot</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Term</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Last payment logged</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Source</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Intake</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Plan tools</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {memberships.map((membership) => {
                const isOnboardedByMe = membership.onboarded_by === ctx.user?.id;
                const plansForOutlet: MembershipPlanAdminRow[] = planRows.filter(
                  (plan) => plan.outlet_id === membership.outlet_id && plan.is_active,
                );

                return (
                  <tr key={membership.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {membership.profile?.full_name || "Unnamed customer"}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">{membership.profile?.email || "No email"}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {membership.outlet?.name || "Unknown outlet"}
                      {membership.outlet?.city ? ` (${membership.outlet.city})` : ""}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{membership.status}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {membership.plan?.name || "No catalogue SKU linked"}
                      {membership.plan_id ? (
                        <span className="mt-1 block text-[11px] text-zinc-500">Linked via plan_id</span>
                      ) : (
                        <span className="mt-1 block text-[11px] text-zinc-500">Customize manually via SQL or assign below</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="font-mono">{membership.start_date ?? "—"}</span>
                      <span className="block text-zinc-500">through {membership.end_date ?? "∞"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {membership.amount_paid != null ? (
                        <>
                          {(membership.currency ?? "INR").toUpperCase()}{" "}
                          {Number(membership.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          isOnboardedByMe
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {isOnboardedByMe ? "Onboarded by you" : "Linked to your outlet"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={adminCustomerOnboardingPath(membership.id)}
                        className="inline-flex rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-100 dark:hover:bg-orange-900/40"
                      >
                        Questionnaire
                      </Link>
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 align-top">
                      <details className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-700 dark:bg-zinc-950/60">
                        <summary className="cursor-pointer select-none text-xs font-semibold text-orange-700 dark:text-orange-200">
                          Assign / renew
                        </summary>
                        <div className="mt-2 border-t border-dashed border-zinc-300 pt-2 dark:border-zinc-700">
                          <MembershipAssignPlanPanel
                            membershipId={membership.id}
                            outletDisplay={[membership.outlet?.name, membership.outlet?.city].filter(Boolean).join(" · ")}
                            status={membership.status}
                            profileLabel={membership.profile?.full_name || membership.profile?.email || membership.profile_id}
                            plans={plansForOutlet}
                            defaultStartDate={isoToday}
                          />
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
