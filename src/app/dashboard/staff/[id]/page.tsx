import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { StaffMemberDetail, type StaffMemberDetailRow } from "@/components/dashboard/StaffMemberDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DashboardFeature } from "@/lib/auth/roles";
import { canManageStaffAssignments, ROLES } from "@/lib/auth/roles";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

const FEATURE: DashboardFeature = "staff";

/**
 * Staff assignment detail — loads assignment, profile, and outlet in separate queries so
 * a blocked profile join does not surface as a generic 404.
 */
export default async function DashboardStaffMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id: assignmentId } = await params;
  const sp = await searchParams;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);
  const isSuperadmin = ctx.appRole === ROLES.SUPERADMIN;

  if (!isSuperadmin && !outletIds.length) {
    return <EmptyState title="No branch scope" description="You need a managed outlet to open staff profiles." />;
  }

  let assignmentQuery = supabase
    .from("staff_assignments")
    .select("id,profile_id,outlet_id,role,is_primary,invite_pending,assigned_at")
    .eq("id", assignmentId)
    .is("revoked_at", null);

  if (!isSuperadmin) {
    assignmentQuery = assignmentQuery.in("outlet_id", outletIds);
  }

  const { data: assignment, error: assignmentError } = await assignmentQuery.maybeSingle();

  if (assignmentError) {
    return <EmptyState title="Could not load profile" description={assignmentError.message} />;
  }

  if (!assignment?.profile_id || !assignment.outlet_id) {
    return (
      <EmptyState
        title="Team member not found"
        description="This assignment may have been removed or is outside your branch scope."
      />
    );
  }

  const service = createServiceRoleSupabaseClient();

  const [{ data: profile, error: profileError }, { data: outlet, error: outletError }] = await Promise.all([
    service
      .from("profiles")
      .select("id,email,full_name,phone,avatar_url")
      .eq("id", assignment.profile_id)
      .maybeSingle(),
    supabase.from("outlets").select("name,city").eq("id", assignment.outlet_id).maybeSingle(),
  ]);

  if (profileError) {
    return <EmptyState title="Could not load profile" description={profileError.message} />;
  }

  if (outletError) {
    return <EmptyState title="Could not load branch" description={outletError.message} />;
  }

  let assignableOutletIds = outletIds;
  if (isSuperadmin) {
    const { data: anchor } = await supabase
      .from("outlets")
      .select("organization_id")
      .eq("id", assignment.outlet_id)
      .maybeSingle();
    if (anchor?.organization_id) {
      const { data: orgOutlets } = await supabase
        .from("outlets")
        .select("id")
        .eq("organization_id", anchor.organization_id)
        .is("deleted_at", null);
      assignableOutletIds = (orgOutlets ?? []).map((o) => o.id).filter(Boolean);
    } else {
      assignableOutletIds = [assignment.outlet_id];
    }
  }

  const { data: outletRows } = await supabase
    .from("outlets")
    .select("id,name,city")
    .in("id", assignableOutletIds.length ? assignableOutletIds : [assignment.outlet_id])
    .is("deleted_at", null)
    .order("name");

  const outlets = ((outletRows ?? []) as { id: string; name: string | null; city: string | null }[]).map((o) => ({
    id: o.id,
    name: o.city?.length ? `${o.name ?? "Branch"} · ${o.city}` : (o.name ?? "Branch"),
  }));

  let siblingQuery = supabase
    .from("staff_assignments")
    .select("id,outlet_id,role,is_primary,assigned_at")
    .eq("profile_id", assignment.profile_id)
    .is("revoked_at", null)
    .neq("role", ROLES.GYM_OWNER);

  if (!isSuperadmin && assignableOutletIds.length) {
    siblingQuery = siblingQuery.in("outlet_id", assignableOutletIds);
  }

  const { data: siblingRows } = await siblingQuery.order("assigned_at", { ascending: true });

  const branchAssignments = (siblingRows ?? []).map((s) => ({
    id: s.id,
    outletId: s.outlet_id,
    role: s.role,
    isPrimary: !!s.is_primary,
    assignedAt: s.assigned_at,
  }));

  const row: StaffMemberDetailRow = {
    assignmentId: assignment.id,
    outletId: assignment.outlet_id,
    role: assignment.role,
    isPrimary: assignment.is_primary,
    invitePending: !!assignment.invite_pending,
    assignedAt: assignment.assigned_at,
    profile: {
      id: assignment.profile_id,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    outlet: outlet ?? null,
  };

  const canManage =
    canManageStaffAssignments(ctx.appRole) &&
    (ctx.appRole === ROLES.SUPERADMIN || ctx.appRole === ROLES.GYM_OWNER);
  const initialEdit = sp.edit === "1" && canManage;

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="mx-auto max-w-3xl space-y-4 pb-16">
        <nav className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={ROUTES.dashboardStaff} className="hover:text-orange-600 dark:hover:text-orange-400">
            Team
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">{row.profile.fullName ?? row.profile.email ?? "Profile"}</span>
        </nav>

        <StaffMemberDetail
          row={row}
          outlets={outlets}
          branchAssignments={branchAssignments}
          canManage={canManage}
          initialEdit={initialEdit}
        />
      </div>
    </RoleGuard>
  );
}
