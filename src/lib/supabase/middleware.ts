import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_ENTRY_ROLES,
  ROLES,
  STAFF_CONSOLE_ROLES,
  dashboardFeatureForPath,
  hasAccess,
  resolveUserRoleFromStaff,
  type DashboardFeature,
  type UserRole,
} from "@/types/roles";
import { ROUTES } from "@/utils/routes";

const PROTECTED_PREFIXES: { prefix: string; roles: readonly UserRole[] }[] = [
  { prefix: ROUTES.superadmin, roles: [ROLES.SUPERADMIN] },
  { prefix: ROUTES.admin, roles: [...DASHBOARD_ENTRY_ROLES] },
  { prefix: ROUTES.dashboard, roles: [...DASHBOARD_ENTRY_ROLES] },
  { prefix: ROUTES.staff, roles: STAFF_CONSOLE_ROLES },
];

function legacyDashboardTarget(pathname: string): string | null {
  if (!(pathname === ROUTES.admin || pathname.startsWith(`${ROUTES.admin}/`))) {
    return null;
  }

  /** These `/admin/**` routes are real App Router pages — do not canonicalize away to `/dashboard`. */
  const staysOnAdmin = [`${ROUTES.admin}/members/onboard`, `${ROUTES.adminCustomers}/onboard`] as const;
  if (staysOnAdmin.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const map: Record<string, string> = {
    [ROUTES.adminCustomers]: ROUTES.dashboardCustomers,
    [ROUTES.adminPlans]: ROUTES.dashboardPlans,
    [`${ROUTES.admin}/staff`]: ROUTES.dashboardStaff,
    [ROUTES.adminOrganization]: ROUTES.dashboardBranches,
    [`${ROUTES.admin}/attendance`]: `${ROUTES.dashboard}/check-ins`,
    [`${ROUTES.admin}/payments`]: ROUTES.dashboard,
  };
  if (pathname === ROUTES.admin) return ROUTES.dashboard;
  /** Legacy staff detail URLs (`/admin/staff/:id`) → `/dashboard/staff/:id`. */
  if (pathname.startsWith(`${ROUTES.admin}/staff/`)) {
    return pathname.replace(`${ROUTES.admin}/staff`, ROUTES.dashboardStaff);
  }
  return map[pathname] ?? pathname.replace(/^\/admin(?=\/|$)/, "/dashboard");
}

function pathRequiresRole(pathname: string): { roles: readonly UserRole[] } | null {
  for (const rule of PROTECTED_PREFIXES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return { roles: rule.roles };
    }
  }
  return null;
}

async function resolveAppRoleForUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<UserRole> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", userId)
    .maybeSingle();

  const { data: staffRows } = await supabase
    .from("staff_assignments")
    .select("role")
    .eq("profile_id", userId)
    .is("revoked_at", null);

  return resolveUserRoleFromStaff(profile?.is_superadmin, staffRows ?? []);
}

function coarseDashboardFeatureDenied(role: UserRole, pathname: string): DashboardFeature | null {
  const feature = dashboardFeatureForPath(pathname);
  if (!feature) return null;
  if (!hasAccess(role, feature, "read")) return feature;
  return null;
}

function applyResponseCookies(source: NextResponse, target: NextResponse) {
  source.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") return;
    target.headers.append(key, value);
  });
}

/**
 * Supabase session refresh + lightweight RBAC for route prefixes + `/dashboard/**` granular checks.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const urlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!urlEnv || !anon) {
    return supabaseResponse;
  }

  const supabase = createServerClient(urlEnv, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && pathname === ROUTES.login) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ROUTES.postLogin;
    const redirected = NextResponse.redirect(redirectUrl);
    applyResponseCookies(supabaseResponse, redirected);
    return redirected;
  }

  const legacyTarget = legacyDashboardTarget(pathname);
  if (legacyTarget && legacyTarget !== pathname) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyTarget;
    const redirected = NextResponse.redirect(redirectUrl);
    applyResponseCookies(supabaseResponse, redirected);
    return redirected;
  }

  const requirement = pathRequiresRole(pathname);
  if (!requirement) {
    return supabaseResponse;
  }

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ROUTES.login;
    redirectUrl.searchParams.set("next", pathname);
    const redirected = NextResponse.redirect(redirectUrl);
    applyResponseCookies(supabaseResponse, redirected);
    return redirected;
  }

  const role = await resolveAppRoleForUser(supabase, user.id);
  if (!requirement.roles.includes(role)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ROUTES.unauthorized;
    const redirected = NextResponse.redirect(redirectUrl);
    applyResponseCookies(supabaseResponse, redirected);
    return redirected;
  }

  if (pathname === ROUTES.dashboard || pathname.startsWith(`${ROUTES.dashboard}/`)) {
    const mismatch = coarseDashboardFeatureDenied(role, pathname);
    if (mismatch) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = ROUTES.unauthorized;
      const redirected = NextResponse.redirect(redirectUrl);
      applyResponseCookies(supabaseResponse, redirected);
      return redirected;
    }
  }

  return supabaseResponse;
}
