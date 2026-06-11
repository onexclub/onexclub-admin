import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_META, type UserRole } from "@/lib/auth/roles";
import { loadGymOrganizationForAdminDashboard } from "@/lib/admin/gym-organization-dashboard";
import type { AuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

/**
 * Signed-in account snapshot for `/dashboard/profile` and shell header chips.
 *
 * **Reuse:** import from layouts (header summary) and the profile Server Component (full detail).
 */

export type UserBranchAssignmentRow = {
  outletId: string;
  outletName: string;
  city: string | null;
  role: string;
  roleLabel: string;
  isPrimary: boolean;
};

export type CurrentUserProfilePageData = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberSince: string | null;
  appRole: UserRole;
  roleLabel: string;
  roleDescription: string;
  gymName: string | null;
  branchAssignments: UserBranchAssignmentRow[];
};

export type AccountHeaderSummary = {
  href: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};

function formatStaffRoleLabel(role: string): string {
  const key = role as UserRole;
  if (key in ROLE_META) return ROLE_META[key].label;
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Lightweight chip for dashboard shell headers — avoids loading branch rows. */
export async function loadAccountHeaderSummary(
  supabase: SupabaseClient,
  ctx: AuthDashboardContext,
): Promise<AccountHeaderSummary | null> {
  if (!ctx.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,avatar_url")
    .eq("id", ctx.user.id)
    .maybeSingle();

  return {
    href: ROUTES.dashboardProfile,
    displayName: profile?.full_name?.trim() || profile?.email || "My profile",
    email: profile?.email ?? ctx.user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export async function loadCurrentUserProfilePageData(
  supabase: SupabaseClient,
  ctx: AuthDashboardContext,
): Promise<CurrentUserProfilePageData | null> {
  if (!ctx.user) return null;

  const [{ data: profile }, { data: assignmentRows }, gymOrg] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,phone,avatar_url,created_at")
      .eq("id", ctx.user.id)
      .maybeSingle(),
    supabase
      .from("staff_assignments")
      .select("outlet_id,role,is_primary,outlet:outlets!outlet_id(name,city)")
      .eq("profile_id", ctx.user.id)
      .is("revoked_at", null)
      .order("is_primary", { ascending: false }),
    loadGymOrganizationForAdminDashboard(supabase, ctx),
  ]);

  if (!profile) return null;

  const meta = ROLE_META[ctx.appRole];

  const branchAssignments: UserBranchAssignmentRow[] = (assignmentRows ?? []).map((row) => {
    const r = row as {
      outlet_id: string;
      role: string;
      is_primary: boolean;
      outlet: { name: string | null; city: string | null } | { name: string | null; city: string | null }[] | null;
    };
    const outlet = firstOrSelf(r.outlet);
    return {
      outletId: r.outlet_id,
      outletName: outlet?.name ?? "Branch",
      city: outlet?.city ?? null,
      role: r.role,
      roleLabel: formatStaffRoleLabel(r.role),
      isPrimary: r.is_primary,
    };
  });

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    memberSince: profile.created_at,
    appRole: ctx.appRole,
    roleLabel: meta.label,
    roleDescription: meta.description,
    gymName: gymOrg?.name ?? null,
    branchAssignments,
  };
}
