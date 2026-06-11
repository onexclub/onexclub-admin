import { ROLES, type UserRole, isGymAdminShellRole, isStaffConsoleRole } from "@/types/roles";

export const ROUTES = {
  login: "/login",
  postLogin: "/auth/post-login",
  forgotPassword: "/forgot-password",
  /** Supabase appends `code` (PKCE) or `token_hash` + `type` to this URL after email confirmation / recovery. */
  authCallback: "/auth/callback",
  authUpdatePassword: "/auth/update-password",
  authCodeError: "/auth/auth-code-error",
  unauthorized: "/unauthorized",
  superadmin: "/superadmin",
  superadminOnboard: "/superadmin/onboard",
  /** All onboarded organizations (gym brands); branch detail lives under `/superadmin/gyms/[orgId]`. */
  superadminGyms: "/superadmin/gyms",
  /** Cross-tenant roster: one row per person; profile opens via primary `gym_memberships` id. */
  superadminCustomers: "/superadmin/customers",
  /** Platform-wide diet + exercise program templates (`plan_templates`). */
  superadminProgramPlans: "/superadmin/program-plans",
  /** New RBAC-aligned gym console (preferred). Historic `/admin` routes redirect via middleware. */
  dashboard: "/dashboard",
  dashboardStaff: "/dashboard/staff",
  dashboardStaffNew: "/dashboard/staff/new",
  dashboardCustomers: "/dashboard/customers",
  /** Add customer 5-step wizard — `/dashboard/customers/onboard` redirects here for legacy bookmarks. */
  dashboardCustomerNew: "/dashboard/customers/new",
  /** Resume explicit localStorage draft from `/dashboard/customers?tab=drafts`. */
  dashboardCustomerNewResume: "/dashboard/customers/new?resume=1",
  /** @deprecated Use {@link ROUTES.dashboardCustomerNew}. Kept for middleware + old links. */
  dashboardCustomerOnboard: "/dashboard/customers/onboard",
  dashboardBranches: "/dashboard/branches",
  dashboardPlans: "/dashboard/plans",
  dashboardDiet: "/dashboard/diet",
  dashboardExercise: "/dashboard/exercise",
  /** Signed-in account — role, branch access, contact details. */
  dashboardProfile: "/dashboard/profile",
  /** Legacy paths — redirects to `/dashboard/*` for backwards-compatible bookmarks. */
  admin: "/admin",
  adminMemberOnboard: "/admin/members/onboard",
  adminCustomers: "/admin/customers",
  adminPlans: "/admin/plans",
  /** Gym profile + settings (hours, closures, HQ/branch edits) for gym admins. */
  adminOrganization: "/admin/organization",
  staff: "/staff",
} as const;

/** One member’s record in the gym console (a `gym_memberships` row). Use with `revalidatePath`. */
export function dashboardCustomerMembershipPath(membershipId: string): string {
  return `${ROUTES.dashboardCustomers}/${membershipId}`;
}

/** Superadmin customer workspace (platform scope). */
export function superadminCustomerMembershipPath(membershipId: string): string {
  return `${ROUTES.superadminCustomers}/${membershipId}`;
}

/** Superadmin gym brand detail page. */
export function superadminGymOrganizationPath(orgId: string): string {
  return `${ROUTES.superadminGyms}/${orgId}`;
}

/** Scrolls to a branch row on the gym detail page. */
export function superadminGymBranchPath(orgId: string, branchId: string): string {
  return `${ROUTES.superadminGyms}/${orgId}#branch-${branchId}`;
}

/** One teammate row (`staff_assignments.id`). Use with `revalidatePath`. */
export function dashboardStaffAssignmentPath(assignmentId: string): string {
  return `${ROUTES.dashboardStaff}/${assignmentId}`;
}

export function adminCustomerOnboardingPath(membershipId: string): string {
  return `${ROUTES.adminCustomers}/${membershipId}/onboarding`;
}

export function dashboardCustomerOnboardingPath(membershipId: string): string {
  return `${ROUTES.dashboardCustomers}/${membershipId}/onboarding`;
}

/** Where to send a user immediately after login based on their resolved `UserRole`. */
export function homePathForRole(role: UserRole): string {
  if (role === ROLES.SUPERADMIN) return ROUTES.superadmin;
  if (isGymAdminShellRole(role)) return ROUTES.dashboard;
  /** Floor staff historically hit `/staff` first; middleware still exposes `/dashboard` sections they can read. */
  if (isStaffConsoleRole(role)) return ROUTES.staff;
  return ROUTES.unauthorized;
}
