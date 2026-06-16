import { Suspense } from "react";
import { CustomerOnboardWizard } from "@/components/dashboard/customer-onboard/CustomerOnboardWizard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { todayUtcIsoDate } from "@/lib/date-term";
import type { DashboardFeature } from "@/lib/auth/roles";
import { fetchMembershipPlansForOutlets } from "@/lib/admin/membership-plans-admin";
import { listTrainersGroupedByOutlet } from "@/lib/admin/outlet-trainers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { resolveActiveBranchSession } from "@/lib/auth/active-branch-session";
import { isAdminConsoleRole } from "@/types/roles";

const FEATURE: DashboardFeature = "customers";

/** `/dashboard/customers/new` — 5-step add-customer wizard (phone OTP Auth + optional email). */
export default async function DashboardNewCustomerPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const branchSession = await resolveActiveBranchSession(ctx);
  const adminOutletIds = effectiveManagedOutletIds(ctx);

  if (!ctx.user) {
    return <EmptyState title="Sign in required" description="Authenticate to onboard new customers." />;
  }

  const { data: outletsRaw } = adminOutletIds.length
    ? await supabase
        .from("outlets")
        .select("id,name,city,organization_id,organizations(name)")
        .in("id", adminOutletIds)
        .is("deleted_at", null)
    : { data: [] as { id: string; name: string; city: string | null; organization_id: string; organizations: { name: string } | { name: string }[] | null }[] };

  type OutletRow = {
    id: string;
    name: string;
    city: string | null;
    organization_id: string;
    organizations: { name: string } | { name: string }[] | null;
  };

  const outlets = (outletsRaw ?? []).map((row: OutletRow) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      id: row.id,
      name: row.name,
      city: row.city,
      organization_id: row.organization_id,
      organization_name: org?.name ?? null,
    };
  });

  const { rows: plans, error: planFetchError } = await fetchMembershipPlansForOutlets({
    supabase,
    outletIds: adminOutletIds,
    includeInactive: false,
  });

  const trainersGrouped = adminOutletIds.length
    ? await listTrainersGroupedByOutlet(supabase, adminOutletIds)
    : new Map();
  const trainersByOutlet = Object.fromEntries(trainersGrouped.entries());

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
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
          description="Resolve staff assignments for your gym before onboarding members."
        />
      ) : (
        <Suspense fallback={<EmptyState title="Loading…" description="Preparing add-customer wizard." />}>
          <CustomerOnboardWizard
            outlets={outlets}
            plans={plans}
            defaultStartDate={todayUtcIsoDate()}
            actorProfileId={ctx.user.id}
            ctxRole={ctx.appRole}
            trainersByOutlet={trainersByOutlet}
            preferredOutletId={branchSession.activeOutletId}
          />
        </Suspense>
      )}
    </RoleGuard>
  );
}
