import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLES, type UserRole, resolveUserRoleFromStaff } from "@/types/roles";
import type { ProfileRow, StaffAssignmentRow } from "@/types/database.types";

export type AuthDashboardContext = {
  user: User | null;
  profile: ProfileRow | null;
  /** Resolved role for dashboard routing (aligns with `UserRole` / RLS-backed access). */
  appRole: UserRole;
  /** Active staff rows for the current user (not revoked). */
  staffAssignments: Pick<StaffAssignmentRow, "outlet_id" | "role">[];
  /**
   * Outlet IDs the user may treat as “managed” for `/admin` flows: any `staff_assignments` outlet;
   * gym owners additionally get every outlet in the same organization(s) (matches RLS `i_manage_outlet`).
   */
  managedOutletIds: string[];
  /**
   * Convenience: first outlet the user can operate as an owner/admin, else first staff outlet.
   */
  primaryOutletId: string | null;
};

/**
 * Effective outlet scope for `/admin` UI + server-action guards — mirrors dashboard home fallback
 * (`managedOutletIds` first, else `primaryOutletId`) so gym branding and permissions stay aligned
 * if org-wide ID expansion returns an empty list transiently.
 */
export function effectiveManagedOutletIds(ctx: AuthDashboardContext): string[] {
  if (ctx.managedOutletIds.length > 0) return ctx.managedOutletIds;
  if (ctx.primaryOutletId) return [ctx.primaryOutletId];
  return [];
}

function pickPrimaryOutlet(staff: Pick<StaffAssignmentRow, "outlet_id" | "role">[]): string | null {
  const gymOwner = staff.find((s) => s.role === ROLES.GYM_OWNER);
  if (gymOwner) return gymOwner.outlet_id;
  const branchAdmin = staff.find((s) => s.role === ROLES.BRANCH_ADMIN);
  if (branchAdmin) return branchAdmin.outlet_id;
  return staff[0]?.outlet_id ?? null;
}

/**
 * Resolves outlet scope for the gym dashboard:
 * - Every active `staff_assignments` row contributes its `outlet_id` (receptionist, trainer, branch_admin, gym_owner).
 * - `gym_owner` rows additionally expand to **all** outlets in the same organization(s).
 */
async function loadManagedOutletIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  staff: Pick<StaffAssignmentRow, "outlet_id" | "role">[],
): Promise<string[]> {
  if (!staff.length) return [];

  const ids = new Set<string>();
  for (const row of staff) ids.add(row.outlet_id);

  const ownerOutletIds = staff.filter((s) => s.role === ROLES.GYM_OWNER).map((s) => s.outlet_id);
  if (ownerOutletIds.length > 0) {
    const { data: outlets } = await supabase
      .from("outlets")
      .select("id, organization_id")
      .in("id", ownerOutletIds)
      .is("deleted_at", null);

    const orgIds = [...new Set((outlets ?? []).map((o) => o.organization_id).filter(Boolean))] as string[];
    if (orgIds.length > 0) {
      const { data: orgOutlets } = await supabase
        .from("outlets")
        .select("id")
        .in("organization_id", orgIds)
        .is("deleted_at", null);
      for (const row of orgOutlets ?? []) ids.add(row.id);
    }
  }

  for (const id of ownerOutletIds) ids.add(id);

  return [...ids];
}

/**
 * Loads the signed-in user plus profile/staff rows using the user-scoped server client (RLS on).
 * Use in Server Components and Server Actions before performing role-gated UI or checks.
 */
export async function getAuthDashboardContext(): Promise<AuthDashboardContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      appRole: ROLES.CUSTOMER,
      staffAssignments: [],
      managedOutletIds: [],
      primaryOutletId: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_superadmin, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const { data: staffRows } = await supabase
    .from("staff_assignments")
    .select("outlet_id, role")
    .eq("profile_id", user.id)
    .is("revoked_at", null);

  const staffAssignments = (staffRows ?? []) as Pick<StaffAssignmentRow, "outlet_id" | "role">[];
  const appRole = resolveUserRoleFromStaff((profile as ProfileRow | null)?.is_superadmin, staffAssignments);

  const managedOutletIds = await loadManagedOutletIds(supabase, staffAssignments);

  return {
    user,
    profile: profile as ProfileRow | null,
    appRole,
    staffAssignments,
    managedOutletIds,
    primaryOutletId: pickPrimaryOutlet(staffAssignments),
  };
}

/**
 * True when `outletId` is within `ctx.managedOutletIds` (any staff: assigned outlets; gym owners: all org branches).
 */
export function canManageOutletForBranchAdmin(ctx: AuthDashboardContext, outletId: string): boolean {
  return effectiveManagedOutletIds(ctx).includes(outletId);
}
