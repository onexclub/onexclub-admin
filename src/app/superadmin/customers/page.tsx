import Link from "next/link";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import {
  toPlatformMembershipListItem,
  type PlatformCustomerMembershipListItem,
} from "@/lib/superadmin/customers-membership-mapper";
import {
  buildPlatformCustomerRoster,
  formatExtraLocationsSuffix,
  formatRosterStatusLabel,
} from "@/lib/superadmin/platform-customers-roster";
import { ROLES } from "@/lib/auth/roles";
import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { superadminCustomerMembershipPath } from "@/utils/routes";

type OrgOption = { id: string; name: string };
type OutletOption = { id: string; name: string | null; city: string | null; organization_id: string };

/**
 * Platform-wide customer roster — one row per person (`profiles.id`).
 *
 * Gym/branch links are on each member's profile under Gym memberships.
 */
export default async function SuperadminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; org?: string; outlet?: string; status?: string; plan?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabaseClient();

  const q = (sp.q ?? "").trim();
  const orgFilter = (sp.org ?? "").trim();
  const outletFilter = (sp.outlet ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const planFilter = (sp.plan ?? "").trim();

  const [{ data: orgRows }, { data: outletRows }] = await Promise.all([
    supabase.from("organizations").select("id,name").is("deleted_at", null).order("name", { ascending: true }),
    supabase
      .from("outlets")
      .select("id,name,city,organization_id")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const organizations: OrgOption[] = (orgRows ?? []) as OrgOption[];
  const outlets: OutletOption[] = (outletRows ?? []) as OutletOption[];

  let profileIdsFilter: string[] | null = null;
  if (q.length) {
    /** PostgREST `or()` splits on commas — quote patterns so commas inside emails/names stay literal. */
    const inner = `%${q.replace(/"/g, '""')}%`;
    const { data: matchProfiles } = await supabase
      .from("profiles")
      .select("id")
      .is("deleted_at", null)
      .or(`full_name.ilike."${inner}",email.ilike."${inner}",phone.ilike."${inner}"`);
    profileIdsFilter = (matchProfiles ?? []).map((p: { id: string }) => p.id);
    if (profileIdsFilter.length === 0) {
      profileIdsFilter = [];
    }
  }

  const outletIdsForPlans = outlets.map((o) => o.id);
  const { rows: planRows } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds: outletIdsForPlans,
    includeInactive: false,
  });

  let outletIdsRestricted: string[] | null = null;
  if (outletFilter && outlets.some((o) => o.id === outletFilter)) {
    outletIdsRestricted = [outletFilter];
  } else if (orgFilter && organizations.some((o) => o.id === orgFilter)) {
    outletIdsRestricted = outlets.filter((o) => o.organization_id === orgFilter).map((o) => o.id);
    if (outletIdsRestricted.length === 0) {
      outletIdsRestricted = [];
    }
  }

  let query = supabase
    .from("gym_memberships")
    .select(
      [
        "id,status,outlet_id,profile_id,assigned_trainer_id,onboarded_by,joined_at,plan_id,start_date,end_date,amount_paid,currency",
        "profile:profiles!profile_id(full_name,email,phone)",
        "outlet:outlets(name,city,organization_id,organizations(name,slug))",
        "membership_plans(id,name)",
      ].join(","),
    )
    .eq("role", ROLES.CUSTOMER)
    .is("deleted_at", null);

  if (profileIdsFilter !== null) {
    if (profileIdsFilter.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000001");
    } else {
      query = query.in("profile_id", profileIdsFilter);
    }
  }

  if (outletIdsRestricted !== null) {
    if (outletIdsRestricted.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000001");
    } else {
      query = query.in("outlet_id", outletIdsRestricted);
    }
  }

  if (statusFilter.length) {
    query = query.eq("status", statusFilter);
  }

  if (planFilter.length) {
    query = query.eq("plan_id", planFilter);
  }

  query = query.order("joined_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return <EmptyState title="Unable to load customers" description={error.message} />;
  }

  const memberships: PlatformCustomerMembershipListItem[] = (data ?? []).map(toPlatformMembershipListItem);
  const customers = buildPlatformCustomerRoster(memberships);

  const filtersForm = (
    <form
      method="GET"
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/60 md:grid-cols-6"
    >
      <label className="flex flex-col gap-1 md:col-span-2">
        Search
        <input
          defaultValue={sp.q ?? ""}
          name="q"
          placeholder="Name, email, or phone"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col gap-1">
        Gym
        <select
          defaultValue={orgFilter}
          name="org"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All gyms</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        Branch
        <select
          defaultValue={outletFilter}
          name="outlet"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All branches</option>
          {outlets.map((o) => {
            const orgName = organizations.find((g) => g.id === o.organization_id)?.name ?? "Gym";
            return (
              <option key={o.id} value={o.id}>
                {[o.name, o.city].filter(Boolean).join(" · ") || o.id.slice(0, 8)} ({orgName})
              </option>
            );
          })}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Status
        <select
          defaultValue={statusFilter}
          name="status"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All</option>
          {(["active", "inactive", "suspended", "expired", "pending"] as const).map((s) => (
            <option key={s} value={s}>
              {formatRosterStatusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        Membership plan
        <select
          defaultValue={planFilter}
          name="plan"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All plans</option>
          {planRows.map((p) => {
            const branch = outlets.find((o) => o.id === p.outlet_id);
            const branchLabel = branch ? [branch.name, branch.city].filter(Boolean).join(" · ") : p.outlet_id;
            return (
              <option key={p.id} value={p.id}>
                {p.name} · {branchLabel}
              </option>
            );
          })}
        </select>
      </label>
      <button
        type="submit"
        className="md:col-span-6 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Apply filters
      </button>
    </form>
  );

  const linkClass = "font-semibold text-orange-700 hover:underline dark:text-orange-400";
  const subtleLinkClass = "font-medium text-orange-700 hover:underline dark:text-orange-400";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">All customers</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Every member on the platform, listed once. Open a name to see their profile and gym history.
        </p>
      </div>

      {filtersForm}

      {!customers.length ? (
        <EmptyState title="No members found" description="Try different filters or search terms." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Gym</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Member since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {customers.map((row) => {
                const detailHref = superadminCustomerMembershipPath(row.primary_membership_id);
                const extraSuffix = formatExtraLocationsSuffix(row.extra_location_count);

                return (
                  <tr key={row.profile_id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3">
                      <Link href={detailHref} className={linkClass}>
                        {row.profile?.full_name ?? "Unnamed"}
                      </Link>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{row.profile?.email ?? "—"}</p>
                      {row.profile?.phone ? (
                        <p className="text-xs text-zinc-500">{row.profile.phone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {row.primary_gym_name ? (
                        <Link href={detailHref} className={subtleLinkClass}>
                          {row.primary_gym_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {extraSuffix ? (
                        <>
                          {" "}
                          <Link
                            href={detailHref}
                            className="font-semibold text-zinc-500 hover:text-orange-700 hover:underline dark:text-zinc-400 dark:hover:text-orange-400"
                            title="View all gym memberships"
                          >
                            {extraSuffix}
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.primary_branch_name ? (
                        <Link href={detailHref} className={subtleLinkClass}>
                          {row.primary_branch_name}
                          {row.primary_branch_city ? ` · ${row.primary_branch_city}` : ""}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                      {formatRosterStatusLabel(row.display_status)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.member_since
                        ? formatMembershipTimestampUtcLabel(row.member_since)
                        : "—"}
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
