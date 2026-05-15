import { AddCustomerOnboardWizard } from "@/components/dashboard/AddCustomerOnboardWizard";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayUtcIsoDate } from "@/lib/date-term";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { isAdminConsoleRole } from "@/types/roles";

export default async function AdminMemberOnboardPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  if (!ctx.user || !isAdminConsoleRole(ctx.appRole)) {
    return (
      <EmptyState
        title="Owners and branch admins only"
        description="Member onboarding uses elevated server actions. Receptionists and trainers cannot create Auth accounts."
      />
    );
  }

  const adminOutletIds = effectiveManagedOutletIds(ctx);

  const { data: outlets } = adminOutletIds.length
    ? await supabase.from("outlets").select("id,name,city").in("id", adminOutletIds).is("deleted_at", null)
    : { data: [] as { id: string; name: string; city: string | null }[] };

  const { rows: plans, error: planFetchError } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds: adminOutletIds,
    includeInactive: false,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Add customer (admin shell)</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Same wizard as Dashboard → Customers → Add customer. Prefer that route day-to-day; this page survives legacy bookmarks.
        </p>
      </div>

      {planFetchError ? (
        <EmptyState title="Unable to prefetch plans" description={planFetchError} />
      ) : !outlets?.length ? (
        <EmptyState
          title="No managed outlets"
          description="You need at least one outlet in your managed scope (see `staff_assignments`)."
        />
      ) : (
        <AddCustomerOnboardWizard
          outlets={outlets}
          plans={plans}
          defaultStartDate={todayUtcIsoDate()}
          actorProfileId={ctx.user.id}
          ctxRole={ctx.appRole}
        />
      )}
    </div>
  );
}
