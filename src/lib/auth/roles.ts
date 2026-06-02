/**
 * Central RBAC configuration for the gym admin console (/dashboard/**).
 *
 * **Moderator guide:** `docs/dashboard-rbac.md` explains how to extend routes + permissions without duplicating logic.
 * **Sign-in / OTP expectations per role:** `docs/auth-by-role.md` + `src/lib/auth/role-sign-in-policy.ts` (avoid drifting copy in forms).
 *
 * **Reuse:**
 * - Import `hasAccess`, `canWrite`, `ROLES` from here (or re-exports in `@/types/roles`).
 * - Add new gated routes once: extend `dashboardRouteMatchers` + `FEATURE` permissions below.
 * - UI + middleware + Server Actions stay aligned via the same helpers (no stray string role checks).
 *
 * Lockstep: enum `user_role` in Supabase (`supabase/migrations/001_*`).
 */

export const ROLES = {
  SUPERADMIN: "superadmin",
  GYM_OWNER: "gym_owner",
  BRANCH_ADMIN: "branch_admin",
  RECEPTIONIST: "receptionist",
  TRAINER: "trainer",
  CUSTOMER: "customer",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

/** Roles that gym owners may assign from `/dashboard/staff` (owners themselves are never assignable via UI). */
export const ASSIGNABLE_ROLES = [ROLES.BRANCH_ADMIN, ROLES.RECEPTIONIST, ROLES.TRAINER] as const;
export type AssignableStaffRole = (typeof ASSIGNABLE_ROLES)[number];

export type DashboardFeature =
  /** Home stats + shortcuts */
  | "dashboard"
  /** Branch list / org profile territory */
  | "branches"
  /** Gym members + assignments */
  | "customers"
  /** Catalogue SKU management */
  | "membership_catalog"
  /** Diet planning */
  | "diet_plans"
  /** Workout programming */
  | "exercise_plans"
  /** Staff roster + invites */
  | "staff"
  /** Check-in tooling (reserved for `/dashboard/check-ins` etc.) */
  | "check_ins";

export type AccessMode = "read" | "write";

/** Human-facing labels — never branch UI on labels; they're display only. */
export const ROLE_META: Record<
  UserRole,
  { label: string; description: string }
> = {
  [ROLES.SUPERADMIN]: { label: "Superadmin", description: "Platform owner — full console access." },
  [ROLES.GYM_OWNER]: { label: "Gym owner", description: "Controls every branch in the organisation." },
  [ROLES.BRANCH_ADMIN]: { label: "Branch admin", description: "Manages a single assigned branch." },
  [ROLES.RECEPTIONIST]: { label: "Reception", description: "Front desk membership + arrivals." },
  [ROLES.TRAINER]: { label: "Trainer", description: "Coaching for assigned athletes." },
  [ROLES.CUSTOMER]: { label: "Member", description: "Flutter app user — blocked from `/dashboard`." },
};

/**
 * Coarse-grained permissions by feature — drives middleware (read gate to enter a section),
 * {@link Sidebar} visibility, and guards for broad Server Actions checks.
 *
 * Narrow rules (example: catalogue write limited to gym_owner vs branch_admin read-only) additionally use
 * {@link MEMBERSHIP_CATALOG_EDITOR_ROLES}.
 */
export const PERMISSIONS: Record<
  DashboardFeature,
  { read: readonly UserRole[]; write: readonly UserRole[] }
> = {
  dashboard: {
    read: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
      ROLES.BRANCH_ADMIN,
      ROLES.RECEPTIONIST,
      ROLES.TRAINER,
    ],
    write: [], // dashboards are informational; actions live on sub-features
  },
  branches: {
    /** Receptionists intentionally skip HQ/branch tooling — stick to arrivals + memberships. */
    read: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN, ROLES.TRAINER],
    /** Branch / org edits: owners + admins only — trainers read context for rostering only. */
    write: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN],
  },
  customers: {
    read: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN, ROLES.RECEPTIONIST, ROLES.TRAINER],
    /** Writes include plan assignment/suspensions — narrowed again in helpers per action below. */
    write: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
      ROLES.BRANCH_ADMIN,
      ROLES.RECEPTIONIST,
      ROLES.TRAINER,
    ],
  },
  membership_catalog: {
    read: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
      ROLES.BRANCH_ADMIN,
      ROLES.RECEPTIONIST,
    ],
    write: [], // narrowed via MEMBERSHIP_CATALOG_EDITOR_ROLES
  },
  diet_plans: {
    read: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
      ROLES.BRANCH_ADMIN,
      ROLES.TRAINER,
    ],
    write: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN, ROLES.TRAINER],
  },
  exercise_plans: {
    read: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
      ROLES.BRANCH_ADMIN,
      ROLES.TRAINER,
    ],
    write: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN, ROLES.TRAINER],
  },
  staff: {
    read: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
      ROLES.BRANCH_ADMIN,
    ],
    write: [
      ROLES.SUPERADMIN,
      ROLES.GYM_OWNER,
    ],
  },
  check_ins: {
    read: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN, ROLES.RECEPTIONIST],
    write: [ROLES.SUPERADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_ADMIN, ROLES.RECEPTIONIST],
  },
};

/** Who may create/publish/disable catalogue tiers (branch_admin is read-only in UI). */
export const MEMBERSHIP_CATALOG_EDITOR_ROLES: readonly UserRole[] = [
  ROLES.SUPERADMIN,
  ROLES.GYM_OWNER,
];

export function hasAccess(role: UserRole, feature: DashboardFeature, mode: AccessMode = "read"): boolean {
  if (role === ROLES.CUSTOMER) return false;
  const spec = PERMISSIONS[feature];
  const lane = mode === "read" ? spec.read : spec.write;
  return lane.includes(role);
}

export function canWrite(role: UserRole, feature: DashboardFeature): boolean {
  const spec = PERMISSIONS[feature];
  return spec.write.includes(role);
}

export function canManageStaffAssignments(role: UserRole): boolean {
  return hasAccess(role, "staff", "write");
}

export function canSuspendMembership(role: UserRole): boolean {
  return role === ROLES.SUPERADMIN || role === ROLES.GYM_OWNER || role === ROLES.BRANCH_ADMIN || role === ROLES.RECEPTIONIST;
}

/** Front desk + branch leadership may revise names/phones; trainers stay on programming tables only. */
export function canEditCustomerProfileFields(role: UserRole): boolean {
  return (
    role === ROLES.SUPERADMIN ||
    role === ROLES.GYM_OWNER ||
    role === ROLES.BRANCH_ADMIN ||
    role === ROLES.RECEPTIONIST
  );
}

export function canAssignMembershipPlan(role: UserRole): boolean {
  /** Trainers observe assigned athletes but cannot sell/attach catalogue SKUs. */
  return role === ROLES.SUPERADMIN || role === ROLES.GYM_OWNER || role === ROLES.BRANCH_ADMIN || role === ROLES.RECEPTIONIST;
}

export function canAssignDedicatedTrainer(role: UserRole): boolean {
  /** Front desk assigns coaches when owners/admins delegate. */
  return role === ROLES.SUPERADMIN || role === ROLES.GYM_OWNER || role === ROLES.BRANCH_ADMIN || role === ROLES.RECEPTIONIST;
}

/** Match / rotate exercise + diet template assignments (`customer_plan_assignments`). */
export function canAssignCustomerProgramPlans(role: UserRole): boolean {
  return (
    role === ROLES.SUPERADMIN ||
    role === ROLES.GYM_OWNER ||
    role === ROLES.BRANCH_ADMIN ||
    role === ROLES.TRAINER
  );
}

/** Read program assignments on the customer workspace (broader than assign — incl. reception). */
export function canViewCustomerProgramPlans(role: UserRole): boolean {
  return hasAccess(role, "customers", "read");
}

/** Match `/dashboard*` paths to coarse features — longest match wins inside middleware + nav builder. */
export const dashboardRouteMatchers: { prefix: string; feature: DashboardFeature }[] = [
  { prefix: "/dashboard/staff", feature: "staff" },
  { prefix: "/dashboard/customers", feature: "customers" },
  { prefix: "/dashboard/plans", feature: "membership_catalog" },
  { prefix: "/dashboard/diet", feature: "diet_plans" },
  { prefix: "/dashboard/exercise", feature: "exercise_plans" },
  { prefix: "/dashboard/branches", feature: "branches" },
  { prefix: "/dashboard/check-ins", feature: "check_ins" },
  { prefix: "/dashboard", feature: "dashboard" },
];

export function dashboardFeatureForPath(pathname: string): DashboardFeature | null {
  const normalized = pathname.split("?")[0] ?? pathname;
  for (const { prefix, feature } of dashboardRouteMatchers) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return feature;
    }
  }
  return null;
}

export type SidebarNavPiece = {
  href: string;
  label: string;
  /** Shown beside the route when {@link hasAccess} read but catalogue policy denies writes. */
  badge?: string;
};

/**
 * Sidebar entries for `/dashboard`: derived entirely from RBAC definitions above.
 *
 * Patterns:
 * - When a user lacks read permission, omit the route.
 * - When catalogue read is allowed but they cannot mutate SKUs (`MEMBERSHIP_CATALOG_EDITOR_ROLES`), show `"View Only"`.
 */
export function dashboardSidebarItems(role: UserRole): SidebarNavPiece[] {
  const items: SidebarNavPiece[] = [];
  const pushIf = (
    href: string,
    label: string,
    feature: DashboardFeature,
    viewOnlyBadge?: boolean,
  ) => {
    if (!hasAccess(role, feature, "read")) return;
    let badge: string | undefined;
    if (feature === "membership_catalog" && MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(role) === false) {
      badge = "View Only";
    } else if (viewOnlyBadge && !canWrite(role, feature)) {
      badge = "View Only";
    }
    items.push({ href, label, badge });
  };

  pushIf("/dashboard", "Dashboard", "dashboard");
  pushIf("/dashboard/branches", "Branches & settings", "branches", true);
  pushIf("/dashboard/customers", "Customers", "customers");
  pushIf("/dashboard/plans", "Membership Plans", "membership_catalog");
  pushIf("/dashboard/diet", "Diet Plans", "diet_plans");
  pushIf("/dashboard/exercise", "Exercise Plans", "exercise_plans");
  pushIf("/dashboard/staff", "Staff", "staff");

  return items;
}

/** Everyone except customers may authenticate into `/dashboard` (sub-routes narrowed via {@link PERMISSIONS}). */
export const DASHBOARD_ENTRY_ROLES: readonly UserRole[] = [
  ROLES.SUPERADMIN,
  ROLES.GYM_OWNER,
  ROLES.BRANCH_ADMIN,
  ROLES.RECEPTIONIST,
  ROLES.TRAINER,
];
