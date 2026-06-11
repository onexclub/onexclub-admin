import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CustomerMembershipWorkspace } from "@/components/dashboard/CustomerMembershipWorkspace";
import { CustomerGymHistoryPanel } from "@/components/superadmin/CustomerGymHistoryPanel";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayUtcIsoDate } from "@/lib/date-term";
import { fetchMembershipPlansForOutlets, type MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import {
  ROLES,
  canAssignCustomerProgramPlans,
  canAssignDedicatedTrainer,
  canAssignMembershipPlan,
  canViewCustomerProgramPlans,
} from "@/lib/auth/roles";
import { fetchCustomerProgramPlans } from "@/lib/customers/customer-program-plans";
import { fetchCustomerGymMembershipHistory } from "@/lib/superadmin/customer-gym-history";
import { GYM_MEMBERSHIP_AUDIT_EMBEDS, mapGymMembershipAuditFromRow } from "@/lib/customers/membership-audit";
import type { CustomerMembershipDetailMembership } from "@/lib/customers/membership-detail";
import { listTrainersForOutlet } from "@/lib/admin/outlet-trainers";
import { PROFILE_CONTACT_AND_VITALS_SELECT } from "@/lib/profile/vitals";
import { firstOrSelf, organizationFromOutlet, type OutletWithOrg } from "@/lib/superadmin/customers-membership-mapper";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES, superadminCustomerMembershipPath, superadminGymBranchPath, superadminGymOrganizationPath } from "@/utils/routes";

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

  let programPlans = {
    exercise: null,
    diet: null,
    history: [],
    intakeComplete: false,
  } as Awaited<ReturnType<typeof fetchCustomerProgramPlans>>;

  let gymHistory: Awaited<ReturnType<typeof fetchCustomerGymMembershipHistory>> = [];

  try {
    [programPlans, gymHistory] = await Promise.all([
      fetchCustomerProgramPlans(supabase, membership.profile_id, membership.outlet_id),
      fetchCustomerGymMembershipHistory(supabase, membership.profile_id),
    ]);
  } catch (err) {
    console.error("[superadmin-customer] fetch failed:", err);
  }

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

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {membership.profile?.full_name ?? "Member"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {outletNested?.organization_id && org?.name ? (
            <>
              <Link
                href={superadminGymOrganizationPath(outletNested.organization_id)}
                className="text-orange-700 hover:underline dark:text-orange-400"
              >
                {org.name}
              </Link>
              {" · "}
            </>
          ) : (
            <>{org?.name ?? "Gym"} · </>
          )}
          {outletNested?.organization_id ? (
            <Link
              href={superadminGymBranchPath(outletNested.organization_id, membership.outlet_id)}
              className="text-orange-700 hover:underline dark:text-orange-400"
            >
              {membership.outlet?.name ?? "Branch"}
            </Link>
          ) : (
            (membership.outlet?.name ?? "Branch")
          )}
        </p>
      </div>

      <CustomerGymHistoryPanel rows={gymHistory} currentMembershipId={membershipId} />

      <Suspense fallback={<p className="text-sm text-zinc-500">Loading profile…</p>}>
        <CustomerMembershipWorkspace
          membership={membership}
          catalogue={catalogue}
          defaultStartDate={todayUtcIsoDate()}
          ctxRole={ROLES.SUPERADMIN}
          trainers={trainers}
          canAssignPlan={canAssignMembershipPlan(ROLES.SUPERADMIN)}
          canAssignTrainer={canAssignDedicatedTrainer(ROLES.SUPERADMIN)}
          canAssignProgramPlans={canAssignCustomerProgramPlans(ROLES.SUPERADMIN)}
          canViewProgramPlans={canViewCustomerProgramPlans(ROLES.SUPERADMIN)}
          programPlans={programPlans}
          viewer={viewer}
          basePath={superadminCustomerMembershipPath(membershipId)}
        />
      </Suspense>
    </div>
  );
}
