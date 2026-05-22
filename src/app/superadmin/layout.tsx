import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SuperadminFlashBanner } from "@/components/superadmin/SuperadminFlashBanner";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROLES } from "@/types/roles";
import { ROUTES } from "@/utils/routes";
import { redirect } from "next/navigation";

// Onboarding is reached from "All gyms" (primary button) and dashboard CTAs — not a separate nav item.
const NAV = [
  { href: ROUTES.superadmin, label: "Platform dashboard" },
  { href: ROUTES.superadminGyms, label: "All gyms" },
  { href: ROUTES.superadminCustomers, label: "All customers" },
  { href: `${ROUTES.superadmin}/subscriptions`, label: "Subscriptions (placeholder)" },
  { href: `${ROUTES.superadmin}/settings`, label: "Platform settings (placeholder)" },
];

export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  if (ctx.appRole !== ROLES.SUPERADMIN) {
    redirect(ROUTES.unauthorized);
  }

  return (
    <DashboardShell title="Superadmin" subtitle="Platform-wide controls" navItems={NAV} shellTheme="superadmin">
      {/* useSearchParams: wrap in Suspense for Next.js static shell */}
      <Suspense fallback={null}>
        <SuperadminFlashBanner />
      </Suspense>
      {/* Same as `/dashboard/layout.tsx`: profile workspace intake tabs use TanStack Query. */}
      <QueryProvider>{children}</QueryProvider>
    </DashboardShell>
  );
}
