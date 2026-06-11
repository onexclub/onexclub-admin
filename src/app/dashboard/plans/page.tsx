import { AdminMembershipPlansClient } from "@/components/admin/AdminMembershipPlansClient";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import type { DashboardFeature } from "@/lib/auth/roles";
import { MEMBERSHIP_CATALOG_EDITOR_ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";

const FEATURE: DashboardFeature = "membership_catalog";

export default async function DashboardPlansPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);

  const { data: outlets } = outletIds.length
    ? await supabase.from("outlets").select("id,name,city").in("id", outletIds).is("deleted_at", null)
    : { data: [] as { id: string; name: string; city: string | null }[] };

  const { rows, error } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds,
    includeInactive: true,
  });

  const readOnly = !MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctx.appRole);

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="mx-auto max-w-7xl space-y-8 px-2 sm:px-0">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Membership plans</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Create and manage the plans you offer members — pricing, benefits, and billing terms. Gym owners can add or
            update plans; other staff can view them when helping members sign up.
          </p>
        </div>

        {!outlets?.length ? (
          <EmptyState
            title="No branch assigned"
            description="You need access to at least one branch before you can manage membership plans."
          />
        ) : error ? (
          <EmptyState title="Could not load plans" description={error} />
        ) : (
          <AdminMembershipPlansClient outlets={outlets ?? []} plans={rows ?? []} readOnly={readOnly} />
        )}
      </div>
    </RoleGuard>
  );
}
