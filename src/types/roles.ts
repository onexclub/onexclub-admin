/**
 * Re-exports RBAC primitives from `lib/auth/roles.ts` plus staff-resolution helpers.
 *
 * **Reuse:** keep feature flags in `src/lib/auth/roles.ts`; this file only aggregates “persona” helpers
 * reused by auth routing (`/staff` console) and layout guards.
 */
export {
  ASSIGNABLE_ROLES,
  DASHBOARD_ENTRY_ROLES,
  ROLES,
  canEditCustomerProfileFields,
  canWrite,
  dashboardFeatureForPath,
  dashboardRouteMatchers,
  dashboardSidebarItems,
  hasAccess,
  MEMBERSHIP_CATALOG_EDITOR_ROLES,
  ROLE_META,
  type AccessMode,
  type AssignableStaffRole,
  type DashboardFeature,
  type SidebarNavPiece,
  type UserRole,
} from "@/lib/auth/roles";

import { ASSIGNABLE_ROLES, ROLES, type AssignableStaffRole, type UserRole } from "@/lib/auth/roles";

/** Values permitted on `staff_assignments.role` (not `customer` / not platform `superadmin`). */
export const STAFF_ASSIGNMENT_ROLES = [
  ROLES.GYM_OWNER,
  ROLES.BRANCH_ADMIN,
  ROLES.RECEPTIONIST,
  ROLES.TRAINER,
] as const;

export type StaffAssignmentRole = (typeof STAFF_ASSIGNMENT_ROLES)[number];

/** @deprecated Use `UserRole` — kept as an alias for older imports (`AppRole` sounded route-centric). */
export type AppRole = UserRole;

export function isAssignableStaffRole(role: UserRole): role is AssignableStaffRole {
  return (ASSIGNABLE_ROLES as readonly UserRole[]).includes(role);
}

/**
 * Who may onboard members / perform branch-admin style CRUD (not catalogue editors — see `MEMBERSHIP_CATALOG_EDITOR_ROLES`).
 * Receptionists can sell/assign plans from the customer console but should not create org rows.
 */
export const ADMIN_CONSOLE_ROLES: readonly UserRole[] = [ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN];

/** Who may use `/staff` (front desk / floor operations). */
export const STAFF_CONSOLE_ROLES: readonly UserRole[] = [ROLES.RECEPTIONIST, ROLES.TRAINER];

/**
 * Who may use the legacy `/admin` shell or gym-wide navigation chrome.
 * Includes floor roles so shared loaders work; fine-grained behavior still uses `hasAccess`.
 */
export const GYM_ADMIN_SHELL_ROLES: readonly UserRole[] = [
  ROLES.GYM_OWNER,
  ROLES.BRANCH_ADMIN,
  ROLES.RECEPTIONIST,
  ROLES.TRAINER,
];

export function isAdminConsoleRole(role: UserRole): boolean {
  return ADMIN_CONSOLE_ROLES.includes(role);
}

export function isStaffConsoleRole(role: UserRole): boolean {
  return STAFF_CONSOLE_ROLES.includes(role);
}

export function isGymAdminShellRole(role: UserRole): boolean {
  return GYM_ADMIN_SHELL_ROLES.includes(role);
}

/**
 * Prefer the highest-privilege assignment when a user has multiple rows (e.g. owner + trainer).
 * Order: superadmin (profile) → gym_owner → branch_admin → receptionist → trainer → customer.
 */
export function resolveUserRoleFromStaff(
  isSuperadmin: boolean | null | undefined,
  staffRoles: { role: StaffAssignmentRole }[],
): UserRole {
  if (isSuperadmin) return ROLES.SUPERADMIN;
  if (staffRoles.some((s) => s.role === ROLES.GYM_OWNER)) return ROLES.GYM_OWNER;
  if (staffRoles.some((s) => s.role === ROLES.BRANCH_ADMIN)) return ROLES.BRANCH_ADMIN;
  if (staffRoles.some((s) => s.role === ROLES.RECEPTIONIST)) return ROLES.RECEPTIONIST;
  if (staffRoles.some((s) => s.role === ROLES.TRAINER)) return ROLES.TRAINER;
  return ROLES.CUSTOMER;
}

/** Branch-management assignments used when listing “manageable” outlets in UI helpers. */
export function isBranchManagementAssignmentRole(role: StaffAssignmentRole): boolean {
  return role === ROLES.GYM_OWNER || role === ROLES.BRANCH_ADMIN;
}
