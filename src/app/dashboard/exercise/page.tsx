import { RoleGuard } from "@/components/auth/RoleGuard";
import { ProgramPlanCatalogClient } from "@/components/dashboard/ProgramPlanCatalogClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchProgramPlanTemplates } from "@/lib/admin/program-plan-templates";
import type { DashboardFeature } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";

const FEATURE: DashboardFeature = "exercise_plans";

/** Browse exercise program templates — same cards + detail modal as customer onboarding. */
export default async function DashboardExercisePlansPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);

  const { rows, error } = await fetchProgramPlanTemplates(supabase, {
    outletIds,
    planType: "exercise",
  });

  const defaultOutletId = outletIds[0] ?? "";

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="mx-auto max-w-7xl px-2 sm:px-0">
        {!outletIds.length ? (
          <EmptyState title="Awaiting branch scope" description="You need an outlet assignment to load exercise program templates." />
        ) : error ? (
          <EmptyState title="Unable to load templates" description={error} />
        ) : (
          <ProgramPlanCatalogClient
            planType="exercise"
            templates={rows}
            defaultOutletId={defaultOutletId}
            title="Exercise plans"
            description="Workout program templates matched to members from intake goals and fitness level. Click a card to view weeks, days, and exercises."
          />
        )}
      </div>
    </RoleGuard>
  );
}
