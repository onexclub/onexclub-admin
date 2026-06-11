import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SuperadminFlashBanner } from "@/components/superadmin/SuperadminFlashBanner";
import { getAuthDashboardContext } from "@/services/auth.service";
import { loadAccountHeaderSummary } from "@/lib/account/current-user-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLES } from "@/types/roles";
import { ROUTES } from "@/utils/routes";
import { redirect } from "next/navigation";

// Onboarding is reached from "All gyms" (primary button) and dashboard CTAs — not a separate nav item.
// Subscriptions + platform settings routes exist as stubs (`/superadmin/subscriptions`, `/superadmin/settings`)
// but stay out of nav until billing / feature flags are implemented (gyms are free for now).
const NAV = [
  { href: ROUTES.superadmin, label: "Platform dashboard" },
  { href: ROUTES.superadminGyms, label: "All gyms" },
  { href: ROUTES.superadminCustomers, label: "All customers" },
  { href: ROUTES.superadminProgramPlans, label: "Program plans" },
];

export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  if (ctx.appRole !== ROLES.SUPERADMIN) {
    redirect(ROUTES.unauthorized);
  }

  const supabase = await createServerSupabaseClient();
  const account = await loadAccountHeaderSummary(supabase, ctx);

  return (
    <DashboardShell title="Superadmin" subtitle="Platform-wide controls" navItems={NAV} shellTheme="superadmin" account={account}>
      {/* useSearchParams: wrap in Suspense for Next.js static shell */}
      <Suspense fallback={null}>
        <SuperadminFlashBanner />
      </Suspense>
      {/* Same as `/dashboard/layout.tsx`: profile workspace intake tabs use TanStack Query. */}
      <QueryProvider>{children}</QueryProvider>
    </DashboardShell>
  );
}
