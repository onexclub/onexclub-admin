import Link from "next/link";
import { notFound } from "next/navigation";
import { MembershipProfileTabs } from "@/components/dashboard/MembershipProfileTabs";
import { CustomerMembershipOnboardingSummaryTab } from "@/features/onboarding/components/CustomerMembershipOnboardingSummaryTab";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { CustomerMembershipDetail } from "@/components/dashboard/CustomerMembershipDetail";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayUtcIsoDate } from "@/lib/date-term";
import { fetchMembershipPlansForOutlets, type MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import type { DashboardFeature } from "@/lib/auth/roles";
import {
  ROLES,
  canAssignDedicatedTrainer,
  canAssignMembershipPlan,
} from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";
import type { CustomerMembershipDetailMembership } from "@/components/dashboard/CustomerMembershipDetail";

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

  let q = supabase
    .from("gym_memberships")
    .select(
      "id,status,outlet_id,profile_id,assigned_trainer_id,onboarded_by,joined_at,plan_id,start_date,end_date,amount_paid,currency,profile:profiles!profile_id(full_name,email,phone),outlet:outlets(name,city),membership_plans(id,name)",
    )
    .eq("id", membershipId)
    .is("deleted_at", null);

  if (ctx.appRole === ROLES.TRAINER && ctx.user) {
    q = q.eq("assigned_trainer_id", ctx.user.id);
  }

  const { data: raw, error } = await q.maybeSingle();

  if (error) {
    return <EmptyState title="Could not load this member" description={error.message} />;
  }
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
  };

  const { rows: planRows } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds,
    includeInactive: false,
  });

  const catalogue: MembershipPlanAdminRow[] = planRows.filter((p) => p.outlet_id === membership.outlet_id && p.is_active);

  const trainers =
    ctx.appRole === ROLES.TRAINER ? [] : await listTrainersForOutlets(supabase, outletIds);

  const viewer: OnboardingViewerContext = {
    role: ctx.appRole,
    profileId: membership.profile_id,
    outletId: membership.outlet_id,
    membershipId: membership.id,
    actorProfileId: ctx.user.id,
    isCustomerActor: ctx.appRole === ROLES.CUSTOMER,
  };

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-6">
        <nav className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={ROUTES.dashboardCustomers} className="hover:text-orange-600 dark:hover:text-orange-400">
            Customers
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">{membership.profile?.full_name ?? "Member"}</span>
        </nav>

        <MembershipProfileTabs
          overviewSlot={
            <CustomerMembershipDetail
              membership={membership}
              catalogue={catalogue}
              defaultStartDate={todayUtcIsoDate()}
              ctxRole={ctx.appRole}
              trainers={trainers}
              canAssignPlan={canAssignMembershipPlan(ctx.appRole)}
              canAssignTrainer={canAssignDedicatedTrainer(ctx.appRole)}
            />
          }
          onboardingSlot={<CustomerMembershipOnboardingSummaryTab viewer={viewer} outletId={membership.outlet_id} />}
        />
      </div>
    </RoleGuard>
  );
}

async function listTrainersForOutlets(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  outletIds: string[],
) {
  if (!outletIds.length) return [];

  const { data } = await supabase
    .from("staff_assignments")
    .select("profile_id, profiles!staff_assignments_profile_id_fkey(full_name,email)")
    .in("outlet_id", outletIds)
    .eq("role", ROLES.TRAINER)
    .is("revoked_at", null);

  type Row = { profile_id: string; profiles: { full_name: string | null; email: string | null } | null | unknown[] };
  const normalized = ((data ?? []) as Row[]).map((row) => {
    const nestedUnknown = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const nested = nestedUnknown as { full_name?: string | null; email?: string | null } | null | undefined;
    return {
      id: row.profile_id,
      full_name: nested?.full_name ?? null,
      email: nested?.email ?? null,
    };
  });

  const dedup = new Map<string, { id: string; full_name: string | null; email: string | null }>();
  for (const row of normalized) dedup.set(row.id, row);
  return [...dedup.values()];
}
