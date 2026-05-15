import Link from "next/link";
import { AddCustomerOnboardWizard } from "@/components/dashboard/AddCustomerOnboardWizard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayUtcIsoDate } from "@/lib/date-term";
import type { DashboardFeature } from "@/lib/auth/roles";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { isAdminConsoleRole } from "@/types/roles";
import { ROUTES } from "@/utils/routes";

const FEATURE: DashboardFeature = "customers";

/**
 * Full “Add customer” wizard (Auth + questionnaires) lives on `/dashboard/**` because `/admin/customers`
 * is canonicalized to `/dashboard/customers` in middleware — avoids dead-end redirects like the old `/admin/members/onboard` loop.
 */
export default async function DashboardAddCustomerWizardPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const adminOutletIds = effectiveManagedOutletIds(ctx);

  if (!ctx.user) {
    return <EmptyState title="Sign in required" description="Authenticate to onboard new customers." />;
  }

  const { data: outlets } = adminOutletIds.length
    ? await supabase.from("outlets").select("id,name,city").in("id", adminOutletIds).is("deleted_at", null)
    : { data: [] as { id: string; name: string; city: string | null }[] };

  const { rows: plans, error: planFetchError } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds: adminOutletIds,
    includeInactive: false,
  });

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="mx-auto max-w-4xl space-y-6 pb-16">
        <nav className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={ROUTES.dashboardCustomers} className="hover:text-orange-600 dark:hover:text-orange-400">
            Customers
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">Add customer</span>
        </nav>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Add customer</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create the Supabase Auth member plus membership row, then complete every intake questionnaire for this outlet.
          </p>
        </div>

        {!isAdminConsoleRole(ctx.appRole) ? (
          <EmptyState
            title="Owners and branch admins only"
            description="New member signup uses the service-role key on the server. Ask a gym owner if you need a customer created."
          />
        ) : planFetchError ? (
          <EmptyState title="Unable to load plans" description={planFetchError} />
        ) : !outlets?.length ? (
          <EmptyState
            title="No managed outlets"
            description="Resolve `staff_assignments` for your gym before onboarding members."
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
    </RoleGuard>
  );
}
