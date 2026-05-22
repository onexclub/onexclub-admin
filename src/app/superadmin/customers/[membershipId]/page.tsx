import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CustomerMembershipWorkspace } from "@/components/dashboard/CustomerMembershipWorkspace";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMembershipTimestampUtcLabel, todayUtcIsoDate } from "@/lib/date-term";
import { fetchMembershipPlansForOutlets, type MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import {
  ROLES,
  canAssignDedicatedTrainer,
  canAssignMembershipPlan,
} from "@/lib/auth/roles";
import { GYM_MEMBERSHIP_AUDIT_EMBEDS, mapGymMembershipAuditFromRow } from "@/lib/customers/membership-audit";
import type { CustomerMembershipDetailMembership } from "@/lib/customers/membership-detail";
import { listTrainersForOutlet } from "@/lib/admin/outlet-trainers";
import { PROFILE_CONTACT_AND_VITALS_SELECT } from "@/lib/profile/vitals";
import { firstOrSelf, organizationFromOutlet, type OutletWithOrg } from "@/lib/superadmin/customers-membership-mapper";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES, superadminCustomerMembershipPath } from "@/utils/routes";

/** Narrow shape for `.select(...)` joins — keeps TS happy when nested embeds widen Supabase inference to parser error types. */
type RawMembershipDetailRow = {
  id: string;
  outlet_id: string;
  profile_id: string;
  status: string;
  assigned_trainer_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  onboarded_by: string | null;
  joined_at: string | null;
  created_by_staff?: unknown;
  updated_by_staff?: unknown;
  onboarded_by_staff?: unknown;
  plan_id: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_paid: number | null;
  currency: string | null;
  profile: unknown;
  outlet: unknown;
  membership_plans: unknown;
};

/**
 * Platform-scoped membership workspace — reuses {@link CustomerMembershipWorkspace} from `/dashboard/customers/[id]`.
 *
 * **Reuse:** Row fetch + trainer listing mirror `src/app/dashboard/customers/[membershipId]/page.tsx`; outlet guards differ (superadmin sees every tenant via RLS + {@link canManageOutletForBranchAdmin} bypass).
 */
export default async function SuperadminCustomerMembershipPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    return <EmptyState title="Unavailable" description="Sign in as a platform superadmin to view this record." />;
  }

  const { data: rawData, error } = await supabase
    .from("gym_memberships")
    .select(
      [
        `id,status,outlet_id,profile_id,assigned_trainer_id,joined_at,plan_id,start_date,end_date,amount_paid,currency,${GYM_MEMBERSHIP_AUDIT_EMBEDS}`,
        `profile:profiles!profile_id(${PROFILE_CONTACT_AND_VITALS_SELECT})`,
        "outlet:outlets(name,city,organization_id,organizations(name,slug))",
        "membership_plans(id,name)",
      ].join(","),
    )
    .eq("id", membershipId)
    .eq("role", ROLES.CUSTOMER)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return <EmptyState title="Could not load this member" description={error.message} />;
  }

  const raw = rawData as RawMembershipDetailRow | null;
  if (!raw?.outlet_id) {
    notFound();
  }

  const membership: CustomerMembershipDetailMembership = {
    id: raw.id,
    status: raw.status,
    outlet_id: raw.outlet_id,
    profile_id: raw.profile_id,
    assigned_trainer_id: raw.assigned_trainer_id ?? null,
    joined_at: raw.joined_at,
    start_date: raw.start_date,
    end_date: raw.end_date,
    amount_paid: raw.amount_paid,
    currency: raw.currency,
    profile: firstOrSelf(raw.profile as never) as CustomerMembershipDetailMembership["profile"],
    outlet: firstOrSelf(raw.outlet as never) as CustomerMembershipDetailMembership["outlet"],
    plan: firstOrSelf(raw.membership_plans as never) as CustomerMembershipDetailMembership["plan"],
    audit: mapGymMembershipAuditFromRow(raw as Parameters<typeof mapGymMembershipAuditFromRow>[0]),
  };

  const outletNested = firstOrSelf(raw.outlet as never) as OutletWithOrg | null;
  const org = organizationFromOutlet(outletNested);

  const { rows: planRows } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds: [membership.outlet_id],
    includeInactive: false,
  });

  const catalogue: MembershipPlanAdminRow[] = planRows.filter((p) => p.outlet_id === membership.outlet_id && p.is_active);

  const trainers = await listTrainersForOutlet(supabase, membership.outlet_id);

  const { data: membershipsForProfileRaw } = await supabase
    .from("gym_memberships")
    .select("id,status,joined_at,outlet:outlets(name,city,organization_id,organizations(name,slug))")
    .eq("profile_id", membership.profile_id)
    .eq("role", ROLES.CUSTOMER)
    .is("deleted_at", null)
    .order("joined_at", { ascending: false });

  type SibRow = {
    id: string;
    status: string;
    joined_at: string | null;
    outlet: OutletWithOrg | OutletWithOrg[] | null | unknown;
  };

  const membershipsForProfile: SibRow[] = (membershipsForProfileRaw ?? []) as SibRow[];

  const viewer: OnboardingViewerContext = {
    role: ROLES.SUPERADMIN,
    profileId: membership.profile_id,
    outletId: membership.outlet_id,
    membershipId: membership.id,
    actorProfileId: ctx.user.id,
    isCustomerActor: false,
  };

  return (
    <div className="space-y-6">
      <nav className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href={ROUTES.superadminCustomers} className="hover:text-orange-600 dark:hover:text-orange-400">
          All customers
        </Link>
        <span aria-hidden className="px-2 text-zinc-400">
          /
        </span>
        <span className="text-zinc-900 dark:text-zinc-100">{membership.profile?.full_name ?? "Member"}</span>
      </nav>

      <section className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">Platform view</p>
        <p className="mt-1 text-xs opacity-90">
          You are viewing <span className="font-medium">{org?.name ?? "—"}</span>
          {org?.slug ? (
            <>
              {" "}
              (<span className="font-mono">{org.slug}</span>)
            </>
          ) : null}{" "}
          — branch <span className="font-medium">{membership.outlet?.name ?? membership.outlet_id}</span>. Edits use the same server actions as gym dashboards and sync everywhere.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Memberships for this person</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Floating customers may hold one row per branch. Current row is highlighted.
        </p>
        {!membershipsForProfile.length ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No membership rows returned.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {membershipsForProfile.map((row) => {
              const o = firstOrSelf(row.outlet as OutletWithOrg | OutletWithOrg[] | null);
              const g = organizationFromOutlet(o);
              const isCurrent = row.id === membershipId;
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{o?.name ?? "Branch"}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {g?.name ?? "—"} · {row.status}
                      {row.joined_at ? ` · joined ${formatMembershipTimestampUtcLabel(row.joined_at)}` : ""}
                    </p>
                  </div>
                  {isCurrent ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-950/80 dark:text-orange-100">
                      Viewing
                    </span>
                  ) : (
                    <Link
                      href={superadminCustomerMembershipPath(row.id)}
                      className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
                    >
                      Open
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Suspense fallback={<p className="text-sm text-zinc-500">Loading profile…</p>}>
        <CustomerMembershipWorkspace
          membership={membership}
          catalogue={catalogue}
          defaultStartDate={todayUtcIsoDate()}
          ctxRole={ROLES.SUPERADMIN}
          trainers={trainers}
          canAssignPlan={canAssignMembershipPlan(ROLES.SUPERADMIN)}
          canAssignTrainer={canAssignDedicatedTrainer(ROLES.SUPERADMIN)}
          viewer={viewer}
          basePath={superadminCustomerMembershipPath(membershipId)}
        />
      </Suspense>
    </div>
  );
}
