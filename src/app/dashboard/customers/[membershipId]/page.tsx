import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CustomerProfileHeader } from "@/components/dashboard/CustomerProfileHeader";
import { CustomerMembershipWorkspace } from "@/components/dashboard/CustomerMembershipWorkspace";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { todayUtcIsoDate } from "@/lib/date-term";
import { fetchMembershipPlansForOutlets, type MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import type { DashboardFeature } from "@/lib/auth/roles";
import {
  ROLES,
  canAssignCustomerProgramPlans,
  canAssignDedicatedTrainer,
  canAssignMembershipPlan,
  canViewCustomerProgramPlans,
} from "@/lib/auth/roles";
import { fetchCustomerProgramPlans } from "@/lib/customers/customer-program-plans";
import { listTrainersForOutlets } from "@/lib/admin/outlet-trainers";
import type { CustomerMembershipDetailMembership } from "@/lib/customers/membership-detail";
import { GYM_MEMBERSHIP_AUDIT_EMBEDS, mapGymMembershipAuditFromRow } from "@/lib/customers/membership-audit";
import { PROFILE_CONTACT_AND_VITALS_SELECT } from "@/lib/profile/vitals";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES, dashboardCustomerMembershipPath } from "@/utils/routes";

const FEATURE: DashboardFeature = "customers";

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function DashboardCustomerMembershipPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);

  if (!ctx.user) {
    return <EmptyState title="Sign in required" description="Authenticate to open customer workspaces." />;
  }

  if (!outletIds.length) {
    return (
      <EmptyState
        title="No branch assigned"
        description="You need a managed branch before you can open customer records."
      />
    );
  }

  const membershipSelect = [
    "id",
    "status",
    "outlet_id",
    "profile_id",
    "assigned_trainer_id",
    "joined_at",
    "plan_id",
    "start_date",
    "end_date",
    "amount_paid",
    "currency",
    GYM_MEMBERSHIP_AUDIT_EMBEDS,
    `profile:profiles!profile_id(${PROFILE_CONTACT_AND_VITALS_SELECT})`,
    "outlet:outlets(name,city)",
    "membership_plans(id,name)",
  ].join(",");

  let q = supabase
    .from("gym_memberships")
    .select(membershipSelect)
    .eq("id", membershipId)
    .is("deleted_at", null);

  if (ctx.appRole === ROLES.TRAINER && ctx.user) {
    q = q.eq("assigned_trainer_id", ctx.user.id);
  }

  const { data, error } = await q.maybeSingle();

  if (error) {
    return <EmptyState title="Could not load this member" description={error.message} />;
  }

  type RawMembershipRow = {
    id: string;
    status: string;
    outlet_id: string;
    profile_id: string;
    assigned_trainer_id?: string | null;
    joined_at: string | null;
    start_date: string | null;
    end_date: string | null;
    amount_paid: number | null;
    currency: string | null;
    profile: unknown;
    outlet: unknown;
    membership_plans: unknown;
  };

  const raw = data as RawMembershipRow | null;

  if (!raw?.outlet_id || !outletIds.includes(raw.outlet_id)) {
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
    profile: firstOrSelf(raw.profile as never),
    outlet: firstOrSelf(raw.outlet as never),
    plan: firstOrSelf(raw.membership_plans as never),
    audit: mapGymMembershipAuditFromRow(raw as Parameters<typeof mapGymMembershipAuditFromRow>[0]),
  };

  const { rows: planRows } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds,
    includeInactive: false,
  });

  const catalogue: MembershipPlanAdminRow[] = planRows.filter((p) => p.outlet_id === membership.outlet_id && p.is_active);

  const trainers =
    ctx.appRole === ROLES.TRAINER ? [] : await listTrainersForOutlets(supabase, outletIds);

  let programPlans = {
    exercise: null,
    diet: null,
    history: [],
    intakeComplete: false,
  } as Awaited<ReturnType<typeof fetchCustomerProgramPlans>>;

  if (canViewCustomerProgramPlans(ctx.appRole)) {
    try {
      programPlans = await fetchCustomerProgramPlans(supabase, membership.profile_id, membership.outlet_id);
    } catch (err) {
      console.error("[customer-program-plans] fetch failed:", err);
    }
  }

  const viewer: OnboardingViewerContext = {
    role: ctx.appRole,
    profileId: membership.profile_id,
    outletId: membership.outlet_id,
    membershipId: membership.id,
    actorProfileId: ctx.user.id,
    isCustomerActor: ctx.appRole === ROLES.CUSTOMER,
  };

  const basePath = dashboardCustomerMembershipPath(membershipId);

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-6">
        <nav className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={ROUTES.dashboardCustomers} className="hover:text-brand">
            Customers
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">{membership.profile?.full_name ?? "Member"}</span>
        </nav>

        <CustomerProfileHeader
          fullName={membership.profile?.full_name ?? null}
          phone={membership.profile?.phone ?? null}
          email={membership.profile?.email ?? null}
          outletLabel={[membership.outlet?.name, membership.outlet?.city].filter(Boolean).join(" · ")}
          status={membership.status}
          endDate={membership.end_date}
          joinedAt={membership.joined_at}
        />

        <Suspense fallback={<p className="text-sm text-zinc-500">Loading profile…</p>}>
          <CustomerMembershipWorkspace
            membership={membership}
            catalogue={catalogue}
            defaultStartDate={todayUtcIsoDate()}
            ctxRole={ctx.appRole}
            trainers={trainers}
            canAssignPlan={canAssignMembershipPlan(ctx.appRole)}
            canAssignTrainer={canAssignDedicatedTrainer(ctx.appRole)}
            canAssignProgramPlans={canAssignCustomerProgramPlans(ctx.appRole)}
            canViewProgramPlans={canViewCustomerProgramPlans(ctx.appRole)}
            programPlans={programPlans}
            viewer={viewer}
            basePath={basePath}
          />
        </Suspense>
      </div>
    </RoleGuard>
  );
}
