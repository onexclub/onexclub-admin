import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { CustomerCustomersViewTabs } from "@/components/dashboard/CustomerCustomersViewTabs";
import { CustomerOnboardDraftPanel } from "@/components/dashboard/CustomerOnboardDraftPanel";
import { CustomerRosterFilters } from "@/components/dashboard/CustomerRosterFilters";
import { CustomerRosterPagination } from "@/components/dashboard/CustomerRosterPagination";
import { CustomerRosterTable } from "@/components/dashboard/CustomerRosterTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import { listTrainersGroupedByOutlet } from "@/lib/admin/outlet-trainers";
import {
  joinedAtOrderAscending,
  parseCustomerRosterSort,
  sortCustomerRosterRows,
} from "@/lib/customers/roster-sort";
import {
  paginateCustomerRosterRows,
  parseCustomerRosterPage,
  parseCustomerRosterPageSize,
} from "@/lib/customers/roster-pagination";
import type { DashboardFeature } from "@/lib/auth/roles";
import { ROLES, canAssignDedicatedTrainer } from "@/lib/auth/roles";
import { PROFILE_GENDER_OPTIONS } from "@/lib/profile/vitals";
import { todayUtcIsoDate } from "@/lib/date-term";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { isAdminConsoleRole } from "@/types/roles";
import { ROUTES } from "@/utils/routes";

const FEATURE: DashboardFeature = "customers";

const GENDER_FILTER_VALUES = new Set([
  "unset",
  ...PROFILE_GENDER_OPTIONS.map((o) => o.value),
]);

type MembershipListItem = {
  id: string;
  status: string;
  outlet_id: string;
  profile_id: string;
  joined_at: string | null;
  plan_id: string | null;
  start_date: string | null;
  end_date: string | null;
  assigned_trainer_id: string | null;
  assigned_trainer_name: string | null;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  outlet: { name: string | null; city: string | null } | null;
  plan: { id: string; name: string; price: number | null; currency: string | null } | null;
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
    joined_at: string | null;
    plan_id: string | null;
    start_date: string | null;
    end_date: string | null;
    profile: unknown;
    outlet: { name: string | null; city: string | null } | null | unknown[];
    membership_plans: { id: string; name: string; price: number | null; currency: string | null } | null | unknown[] | unknown;
    assigned_trainer_id?: string | null;
    assigned_trainer?: { full_name: string | null; email: string | null } | null | unknown[] | unknown;
  };
  const trainerNested = firstOrSelf(r.assigned_trainer as never);
  const trainerName =
    (trainerNested as { full_name?: string | null; email?: string | null } | null)?.full_name?.trim() ||
    (trainerNested as { full_name?: string | null; email?: string | null } | null)?.email?.trim() ||
    null;
  return {
    id: r.id,
    status: r.status,
    outlet_id: r.outlet_id,
    profile_id: r.profile_id,
    joined_at: r.joined_at,
    plan_id: r.plan_id,
    start_date: r.start_date,
    end_date: r.end_date,
    assigned_trainer_id: r.assigned_trainer_id ?? null,
    assigned_trainer_name: trainerName,
    profile: firstOrSelf(r.profile as never),
    outlet: firstOrSelf(r.outlet as never),
    plan: firstOrSelf(r.membership_plans as never),
  };
}

/** `/dashboard/customers` — searchable roster; "New customer" starts `/dashboard/customers/new`. */
export default async function DashboardCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    outlet?: string;
    plan?: string;
    gender?: string;
    status?: string;
    sort?: string;
    page?: string;
    limit?: string;
    tab?: string;
  }>;
}) {
  const sp = await searchParams;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = effectiveManagedOutletIds(ctx);
  const q = (sp.q ?? "").trim().toLowerCase();
  const outletFilter = (sp.outlet ?? "").trim();
  const planFilter = (sp.plan ?? "").trim();
  const genderFilter = (sp.gender ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const sort = parseCustomerRosterSort(sp.sort);
  const page = parseCustomerRosterPage(sp.page);
  const pageSize = parseCustomerRosterPageSize(sp.limit);
  const activeTab = sp.tab === "drafts" ? "drafts" : "members";
  const showDraftsTab = isAdminConsoleRole(ctx.appRole) && ctx.user;

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

  let profileIdsFilter: string[] | null = null;
  if (genderFilter.length && GENDER_FILTER_VALUES.has(genderFilter)) {
    let profileQuery = supabase.from("profiles").select("id").is("deleted_at", null);
    if (genderFilter === "unset") {
      profileQuery = profileQuery.is("gender", null);
    } else {
      profileQuery = profileQuery.eq("gender", genderFilter);
    }
    const { data: matchProfiles } = await profileQuery;
    profileIdsFilter = (matchProfiles ?? []).map((p: { id: string }) => p.id);
    if (profileIdsFilter.length === 0) {
      profileIdsFilter = [];
    }
  }

  let query = supabase
    .from("gym_memberships")
    .select(
      `id,status,outlet_id,profile_id,joined_at,plan_id,start_date,end_date,assigned_trainer_id,profile:profiles!profile_id(full_name,email,phone),outlet:outlets(name,city),membership_plans(id,name,price,currency),assigned_trainer:profiles!gym_memberships_assigned_trainer_id_fkey(full_name,email)`,
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

  const VALID_STATUS = new Set(["active", "inactive", "suspended", "expired", "pending"]);
  if (statusFilter.length && VALID_STATUS.has(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  if (profileIdsFilter !== null) {
    if (profileIdsFilter.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000001");
    } else {
      query = query.in("profile_id", profileIdsFilter);
    }
  }

  if (sort === "joined_desc" || sort === "joined_asc") {
    query = query.order("joined_at", { ascending: joinedAtOrderAscending(sort), nullsFirst: false });
  } else {
    query = query.order("joined_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    return <EmptyState title="Unable to load memberships" description={error.message} />;
  }

  let memberships = (data ?? []).map(toMembershipListItem);

  if (q.length) {
    memberships = memberships.filter((row) => {
      const hay = `${row.profile?.full_name ?? ""} ${row.profile?.email ?? ""} ${row.profile?.phone ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  memberships = sortCustomerRosterRows(memberships, sort);

  const paginated = paginateCustomerRosterRows(memberships, page, pageSize);

  const trainersGrouped =
    ctx.appRole === ROLES.TRAINER
      ? new Map<string, never[]>()
      : await listTrainersGroupedByOutlet(supabase, outletIds);
  const trainersByOutlet = Object.fromEntries(trainersGrouped.entries());
  const canAssignTrainer = canAssignDedicatedTrainer(ctx.appRole);

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Customers</h1>
              <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                Members across your branches — search, filter, and open a profile to manage their pass.
              </p>
            </div>
            {showDraftsTab ? (
              <Suspense fallback={null}>
                <CustomerCustomersViewTabs
                  actorProfileId={ctx.user!.id}
                  defaultOutletId={outletOptions[0]?.id ?? ""}
                />
              </Suspense>
            ) : null}
          </div>
          {isAdminConsoleRole(ctx.appRole) ? (
            <Link
              href={ROUTES.dashboardCustomerNew}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              <Plus className="size-4" aria-hidden />
              New customer
            </Link>
          ) : null}
        </div>

        {activeTab === "drafts" && showDraftsTab ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <CustomerOnboardDraftPanel
              actorProfileId={ctx.user!.id}
              outlets={outletOptions}
              defaultStartDate={todayUtcIsoDate()}
            />
          </div>
        ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <Suspense fallback={null}>
            <CustomerRosterFilters
              outlets={outletOptions}
              plans={planRows}
              initialQ={sp.q ?? ""}
              initialOutlet={outletFilter}
              initialPlan={planFilter}
              initialGender={genderFilter}
              initialStatus={statusFilter}
              initialSort={sort}
            />
          </Suspense>

          {paginated.rows.length ? (
            <CustomerRosterTable
              embedded
              rows={paginated.rows}
              trainersByOutlet={trainersByOutlet}
              canAssignTrainer={canAssignTrainer}
            />
          ) : (
            <div className="px-4 py-14 text-center">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">No customers found</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {isAdminConsoleRole(ctx.appRole)
                  ? "Reset filters or add your first member with New customer."
                  : "No members match your filters."}
              </p>
            </div>
          )}

          <Suspense fallback={null}>
            <CustomerRosterPagination
              page={paginated.page}
              pageSize={paginated.pageSize}
              total={paginated.total}
              totalPages={paginated.totalPages}
              rangeFrom={paginated.rangeFrom}
              rangeTo={paginated.rangeTo}
            />
          </Suspense>
        </div>
        )}
      </div>
    </RoleGuard>
  );
}
