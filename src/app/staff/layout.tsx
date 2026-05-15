import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthDashboardContext } from "@/services/auth.service";
import { isStaffConsoleRole } from "@/types/roles";
import { ROUTES } from "@/utils/routes";

const NAV = [
  { href: ROUTES.staff, label: "Overview" },
  { href: `${ROUTES.staff}/members`, label: "Members" },
];

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  if (!isStaffConsoleRole(ctx.appRole)) {
    redirect(ROUTES.unauthorized);
  }

  return (
    <DashboardShell title="Staff" subtitle="Operational tools" navItems={NAV} shellTheme="admin">
      {children}
    </DashboardShell>
  );
}
