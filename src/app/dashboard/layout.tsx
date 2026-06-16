import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { buildSidebarNavItemsFromPermissions } from "@/components/layout/Sidebar";
import { loadGymOrganizationForAdminDashboard, loadManagedOutletsForAdmin } from "@/lib/admin/gym-organization-dashboard";
import { gymDashboardShellSubtitle } from "@/lib/admin/gym-dashboard-data";
import { loadAccountHeaderSummary } from "@/lib/account/current-user-profile";
import { resolveActiveBranchSession } from "@/lib/auth/active-branch-session";
import { dashboardSidebarItems, DASHBOARD_ENTRY_ROLES, ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

/**
 * Consolidated RBAC-aligned shell (`/dashboard/**`).
 *
 * **Reuse mirrors:** historic `/admin/layout.tsx`; navigation now derives from `dashboardSidebarItems` so middleware + UI agree.
 *
 * Receptionists/trainers authenticate through this layout when they traverse from `/staff` — same guard rails apply everywhere.
 */

export default async function DashboardRootLayout({ children }: { children: ReactNode }) {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  if (!DASHBOARD_ENTRY_ROLES.includes(ctx.appRole)) {
    redirect(ROUTES.unauthorized);
  }

  const supabase = await createServerSupabaseClient();
  const branchSession = await resolveActiveBranchSession(ctx);

  if (branchSession.requiresSelection) {
    redirect(ROUTES.authChooseBranch);
  }

  const gymOrg = await loadGymOrganizationForAdminDashboard(supabase, ctx);
  const managedBranches = await loadManagedOutletsForAdmin(supabase, ctx);
  const account = await loadAccountHeaderSummary(supabase, ctx);

  const branchSwitcherOptions =
    managedBranches.length > 1
      ? managedBranches.map((b) => ({ id: b.id, name: b.name, city: b.city }))
      : [];

  const navItems =
    ctx.appRole === ROLES.SUPERADMIN
      ? buildSidebarNavItemsFromPermissions([
          ...dashboardSidebarItems(ctx.appRole),
          { href: ROUTES.superadmin, label: "Platform console", badge: "Superadmin" },
        ])
      : buildSidebarNavItemsFromPermissions(dashboardSidebarItems(ctx.appRole));

  return (
    <RoleGuard role={ctx.appRole} feature="dashboard">
      <DashboardShell
        title="Gym overview"
        subtitle={gymDashboardShellSubtitle(managedBranches.length)}
        navItems={navItems}
        shellTheme="superadmin"
        railBrand={{
          kind: "gym",
          name: gymOrg?.name ?? "Your gym",
          logoUrl: gymOrg?.logo_url ?? null,
          profileHref: ROUTES.dashboardBranches,
        }}
        account={account}
        branchSwitcher={
          branchSwitcherOptions.length > 1
            ? {
                branches: branchSwitcherOptions,
                activeOutletId: branchSession.activeOutletId,
                scope: branchSession.scope,
              }
            : null
        }
      >
        <QueryProvider>{children}</QueryProvider>
      </DashboardShell>
    </RoleGuard>
  );
}
