import Link from "next/link";
import { CreateStaffMemberForm } from "@/components/dashboard/CreateStaffMemberForm";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DashboardFeature } from "@/lib/auth/roles";
import { canManageStaffAssignments } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

const FEATURE: DashboardFeature = "staff";

/**
 * Add teammate — password provisioning + optional photo (`CreateStaffMemberForm`).
 *
 * **Reuse:** Server action `createStaffMemberAction` mirrors member onboard Auth flow without invite emails.
 */
export default async function DashboardAddStaffPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);

  if (!canManageStaffAssignments(ctx.appRole)) {
    return (
      <EmptyState
        title="Owners only"
        description="Only gym owners (or platform superadmins) can add teammates from the dashboard."
      />
    );
  }

  const { data: outlets } = outletIds.length
    ? await supabase.from("outlets").select("id,name,city").in("id", outletIds).is("deleted_at", null)
    : { data: [] as { id: string; name: string | null; city: string | null }[] };

  const outletOptions = (outlets ?? []).map((o) => ({
    id: o.id,
    name: o.city?.length ? `${o.name ?? "Branch"} · ${o.city}` : (o.name ?? "Branch"),
  }));

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE} requireWrite>
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <nav className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={ROUTES.dashboardStaff} className="hover:text-orange-600 dark:hover:text-orange-400">
            Team
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">Add team member</span>
        </nav>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Add team member</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create their login with a temporary password. Assign one branch or several at once — adjust later from their
            profile.
          </p>
        </div>

        {!outletOptions.length ? (
          <EmptyState title="No branches" description="Link an outlet to your account before adding staff." />
        ) : (
          <CreateStaffMemberForm outlets={outletOptions} />
        )}
      </div>
    </RoleGuard>
  );
}
