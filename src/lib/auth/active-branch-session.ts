import { cookies } from "next/headers";
import { ACTIVE_BRANCH_ALL, ACTIVE_BRANCH_COOKIE } from "@/lib/auth/active-branch-constants";
import {
  canManageOutletForBranchAdmin,
  effectiveManagedOutletIds,
  type AuthDashboardContext,
} from "@/services/auth.service";
import { homePathForRole, ROUTES } from "@/utils/routes";

/**
 * Persists the gym admin’s working branch across `/dashboard/**` navigation.
 *
 * **Reuse:** post-login routing, dashboard layout guard, header switcher, and
 * `setActiveBranchAction` in `src/app/auth/choose-branch/actions.ts`.
 *
 * Cookie values:
 * - A managed outlet UUID → scope operational pages to that branch.
 * - {@link ACTIVE_BRANCH_ALL} → combined view (no single-branch filter).
 */
export { ACTIVE_BRANCH_ALL, ACTIVE_BRANCH_COOKIE } from "@/lib/auth/active-branch-constants";

export type ActiveBranchScope = "single" | "all";

export type ActiveBranchResolution = {
  managedOutletIds: string[];
  /** Set when scope is `single`; null when `all` or unresolved. */
  activeOutletId: string | null;
  scope: ActiveBranchScope;
  /** True when user must visit `/auth/choose-branch` before using the dashboard. */
  requiresSelection: boolean;
};

export function resolveActiveOutletId(
  ctx: AuthDashboardContext,
  cookieOutletId: string | null | undefined,
): ActiveBranchResolution {
  const managedOutletIds = effectiveManagedOutletIds(ctx);

  if (!managedOutletIds.length) {
    return {
      managedOutletIds,
      activeOutletId: null,
      scope: "all",
      requiresSelection: false,
    };
  }

  if (managedOutletIds.length === 1) {
    return {
      managedOutletIds,
      activeOutletId: managedOutletIds[0]!,
      scope: "single",
      requiresSelection: false,
    };
  }

  const raw = cookieOutletId?.trim();
  if (raw === ACTIVE_BRANCH_ALL) {
    return {
      managedOutletIds,
      activeOutletId: null,
      scope: "all",
      requiresSelection: false,
    };
  }

  if (raw && managedOutletIds.includes(raw)) {
    return {
      managedOutletIds,
      activeOutletId: raw,
      scope: "single",
      requiresSelection: false,
    };
  }

  return {
    managedOutletIds,
    activeOutletId: null,
    scope: "all",
    requiresSelection: true,
  };
}

export async function readActiveOutletIdCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_BRANCH_COOKIE)?.value ?? null;
}

export async function setActiveOutletIdCookie(outletId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_BRANCH_COOKIE, outletId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Same-origin `/dashboard/**` only — used after branch pick / switch. */
export function safeDashboardNextPath(raw: string | null | undefined): string {
  const fallback = ROUTES.dashboard;
  if (!raw) return fallback;
  const t = raw.trim();
  if (!t.startsWith("/dashboard") || t.startsWith("//")) return fallback;
  return t;
}

export async function resolveActiveBranchSession(
  ctx: AuthDashboardContext,
): Promise<ActiveBranchResolution> {
  const cookie = await readActiveOutletIdCookie();
  return resolveActiveOutletId(ctx, cookie);
}

/**
 * Post-login target: gym admins with multiple branches go to the chooser first.
 */
export async function resolvePostLoginRedirect(ctx: AuthDashboardContext): Promise<string> {
  const home = homePathForRole(ctx.appRole);
  if (home !== ROUTES.dashboard) return home;

  const session = await resolveActiveBranchSession(ctx);
  if (session.requiresSelection) return ROUTES.authChooseBranch;
  return home;
}

export function validateBranchSelection(
  ctx: AuthDashboardContext,
  outletId: string,
): { ok: true } | { ok: false; message: string } {
  if (outletId === ACTIVE_BRANCH_ALL) {
    if (effectiveManagedOutletIds(ctx).length <= 1) {
      return { ok: false, message: "Combined view is only available with multiple branches." };
    }
    return { ok: true };
  }

  if (!canManageOutletForBranchAdmin(ctx, outletId)) {
    return { ok: false, message: "You cannot manage that branch." };
  }

  return { ok: true };
}

/** URL `?outlet=` wins; otherwise use the signed-in working branch when scope is single. */
export function activeBranchOutletFilter(
  session: ActiveBranchResolution,
  urlOutletFilter: string,
): string {
  const fromUrl = urlOutletFilter.trim();
  if (fromUrl) return fromUrl;
  if (session.scope === "single" && session.activeOutletId) return session.activeOutletId;
  return "";
}
