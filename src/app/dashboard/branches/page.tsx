import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { GymProfileSettingsSection } from "@/components/admin/GymProfileSettingsSection";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DashboardFeature } from "@/lib/auth/roles";
import { canWrite, ROLES } from "@/lib/auth/roles";
import {
  loadGymOrganizationForAdminDashboard,
  loadManagedOutletDetailsForAdmin,
} from "@/lib/admin/gym-organization-dashboard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

const FEATURE: DashboardFeature = "branches";

/** Branch/org profile + settings — rebranded `/admin/organization`; permissions via `FEATURE`. */

export default async function DashboardBranchesPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const org = await loadGymOrganizationForAdminDashboard(supabase, ctx);
  const outlets = await loadManagedOutletDetailsForAdmin(supabase, ctx);

  const canEditOrg = ctx.appRole === ROLES.GYM_OWNER || ctx.appRole === ROLES.SUPERADMIN;
  const canEditBranches = canWrite(ctx.appRole, "branches");

  if (!outlets.length) {
    return (
      <EmptyState
        title="No locations in scope"
        description='Request a gym owner assignment so `staff_assignments` links you with an outlet row.'
      />
    );
  }

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Branches &amp; settings</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your gym brand, branch addresses, opening hours, and holiday closures.
          </p>
        </div>

        {!org ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="status">
            <p className="font-medium text-amber-50">HQ / brand details did not load</p>
            <p className="mt-1 text-amber-100/90">
              Branches exist, but the parent organisation row is missing from this view — often an RLS mismatch.
            </p>
          </div>
        ) : null}

        <GymProfileSettingsSection
          org={org}
          outlets={outlets}
          canEditOrg={canEditOrg}
          canEditBranches={canEditBranches}
        />

        <p className="text-xs text-zinc-500">
          Add roster entries from{" "}
          <Link className="font-medium text-orange-600 hover:underline" href={ROUTES.dashboardCustomerNew}>
            Add customer
          </Link>
          .
        </p>
      </div>
    </RoleGuard>
  );
}
