import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { buildSidebarNavItemsFromPermissions } from "@/components/layout/Sidebar";
import { loadGymOrganizationForAdminDashboard } from "@/lib/admin/gym-organization-dashboard";
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
  const gymOrg = await loadGymOrganizationForAdminDashboard(supabase, ctx);

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
        title="Gym dashboard"
        subtitle="Role-aware console scoped to branches you operate."
        navItems={navItems}
        shellTheme="superadmin"
        railBrand={{
          kind: "gym",
          name: gymOrg?.name ?? "Your gym",
          logoUrl: gymOrg?.logo_url ?? null,
          profileHref: ROUTES.dashboardBranches,
        }}
      >
        <QueryProvider>{children}</QueryProvider>
      </DashboardShell>
    </RoleGuard>
  );
}
