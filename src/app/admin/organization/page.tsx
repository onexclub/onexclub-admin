import Link from "next/link";
import { GymProfileSettingsSection } from "@/components/admin/GymProfileSettingsSection";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  loadGymOrganizationForAdminDashboard,
  loadManagedOutletDetailsForAdmin,
} from "@/lib/admin/gym-organization-dashboard";
import { canWrite, ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

/** Gym profile + settings (name, address, hours, closures). Data: `gym-organization-dashboard` loaders. */

export default async function AdminOrganizationPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const org = await loadGymOrganizationForAdminDashboard(supabase, ctx);
  const outlets = await loadManagedOutletDetailsForAdmin(supabase, ctx);

  const canEditOrg = ctx.appRole === ROLES.GYM_OWNER || ctx.appRole === ROLES.SUPERADMIN;
  const canEditBranches = canWrite(ctx.appRole, "branches");

  if (!outlets.length) {
    return (
      <EmptyState
        title="No locations in your scope"
        description="We could not load any outlets for this account. If you just received access, refresh the page. Otherwise ask your platform team to confirm an active `staff_assignments` row for your profile on an outlet."
        action={
          <Link
            href={ROUTES.admin}
            className="inline-flex rounded-lg border border-orange-500/35 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-orange-500/15"
          >
            Back to dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Gym profile &amp; settings</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Update your brand, branch addresses, daily open/close times, and planned closures so members know when you are
          open.
        </p>
      </div>

      {!org ? (
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          <p className="font-medium text-amber-50">HQ / brand details did not load</p>
          <p className="mt-1 text-amber-100/90">
            Your branches loaded, but the organisation row is missing — often RLS on{" "}
            <code className="rounded bg-black/20 px-1 text-xs">organizations</code>. Branch settings below may still
            work.
          </p>
        </div>
      ) : null}

      <GymProfileSettingsSection
        org={org}
        outlets={outlets}
        canEditOrg={canEditOrg}
        canEditBranches={canEditBranches}
      />
    </div>
  );
}
