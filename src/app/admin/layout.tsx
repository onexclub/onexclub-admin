import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { loadGymOrganizationForAdminDashboard, loadManagedOutletsForAdmin } from "@/lib/admin/gym-organization-dashboard";
import { gymDashboardShellSubtitle } from "@/lib/admin/gym-dashboard-data";
import { loadAccountHeaderSummary } from "@/lib/account/current-user-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { isAdminConsoleRole, isGymAdminShellRole } from "@/types/roles";
import { ROUTES } from "@/utils/routes";

const FULL_ADMIN_NAV = [
  { href: ROUTES.admin, label: "Dashboard" },
  { href: ROUTES.adminCustomers, label: "Customers" },
  { href: `${ROUTES.admin}/staff`, label: "Manage staff" },
  { href: `${ROUTES.admin}/attendance`, label: "Attendance" },
  { href: `${ROUTES.admin}/payments`, label: "Payments" },
  { href: ROUTES.adminPlans, label: "Membership plans" },
];

/** Receptionists/trainers: gym context + link back to operational `/staff` tools. */
const FLOOR_STAFF_ADMIN_NAV = [
  { href: ROUTES.admin, label: "Dashboard" },
  /** Reception / trainers: customer list + intake forms link from here (same RLS-backed page as leadership). */
  { href: ROUTES.adminCustomers, label: "Customers" },
  { href: ROUTES.adminOrganization, label: "Gym settings" },
  { href: ROUTES.staff, label: "Staff console" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  if (!isGymAdminShellRole(ctx.appRole)) {
    redirect(ROUTES.unauthorized);
  }

  const navItems = isAdminConsoleRole(ctx.appRole) ? FULL_ADMIN_NAV : FLOOR_STAFF_ADMIN_NAV;

  const supabase = await createServerSupabaseClient();
  const gymOrg = await loadGymOrganizationForAdminDashboard(supabase, ctx);
  const managedBranches = await loadManagedOutletsForAdmin(supabase, ctx);
  const account = await loadAccountHeaderSummary(supabase, ctx);

  return (
    <DashboardShell
      title="Gym overview"
      subtitle={gymDashboardShellSubtitle(managedBranches.length)}
      navItems={navItems}
      shellTheme="superadmin"
      railBrand={{
        kind: "gym",
        name: gymOrg?.name ?? "Your gym",
        logoUrl: gymOrg?.logo_url ?? null,
        profileHref: ROUTES.adminOrganization,
      }}
      account={account}
    >
      <QueryProvider>{children}</QueryProvider>
    </DashboardShell>
  );
}
