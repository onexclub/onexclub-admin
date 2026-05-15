import { AdminMembershipPlansClient } from "@/components/admin/AdminMembershipPlansClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import { MEMBERSHIP_CATALOG_EDITOR_ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";

/** Branch catalogue — cards + unified editor hydrate `AdminMembershipPlansClient` (`004_membership_plans.sql`). */
export default async function AdminPlansPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const adminOutletIds = effectiveManagedOutletIds(ctx);

  const { data: outlets } = adminOutletIds.length
    ? await supabase.from("outlets").select("id,name,city").in("id", adminOutletIds).is("deleted_at", null)
    : { data: [] as { id: string; name: string; city: string | null }[] };

  const { rows, error } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds: adminOutletIds,
    includeInactive: true,
  });

  const readOnly = !MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctx.appRole);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-2 sm:px-0">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Membership plans</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Market each tier visually, then iterate — live members referencing <span className="font-mono text-zinc-800 dark:text-zinc-300">plan_id</span> absorb policy
          changes instantly. Offline renewals reuse the exact same catalogue rows surfaced here.
        </p>
      </div>

      {!outlets?.length ? (
        <EmptyState
          title="No managed outlets"
          description="You need a gym owner or branch admin assignment on at least one outlet before publishing catalogue SKUs."
        />
      ) : error ? (
        <EmptyState title="Plans unavailable" description={error || "Unexpected Supabase error."} />
      ) : (
        <AdminMembershipPlansClient outlets={outlets ?? []} plans={rows ?? []} readOnly={readOnly} />
      )}
    </div>
  );
}
