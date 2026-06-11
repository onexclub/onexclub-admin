import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthDashboardContext } from "@/services/auth.service";
import { loadAccountHeaderSummary } from "@/lib/account/current-user-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

  const supabase = await createServerSupabaseClient();
  const account = await loadAccountHeaderSummary(supabase, ctx);

  return (
    <DashboardShell title="Staff" subtitle="Operational tools" navItems={NAV} shellTheme="admin" account={account}>
      {children}
    </DashboardShell>
  );
}
