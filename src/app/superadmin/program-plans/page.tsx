import { ProgramPlanCatalogClient } from "@/components/dashboard/ProgramPlanCatalogClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import {
  buildPlatformPlanScopeLabels,
  loadPlatformProgramPlanCatalog,
  type PlatformProgramPlanTemplateRow,
} from "@/lib/superadmin/platform-program-plans-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROUTES } from "@/utils/routes";

type OrgOption = { id: string; name: string };
type OutletOption = { id: string; name: string | null; city: string | null; organization_id: string };

/**
 * Platform-wide diet & exercise program template catalogue (`plan_templates`).
 *
 * **Reuse:** data from {@link loadPlatformProgramPlanCatalog}; UI cards from {@link ProgramPlanCatalogClient}
 * (same as `/dashboard/diet` and `/dashboard/exercise`, but without outlet scope limits).
 */
export default async function SuperadminProgramPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; outlet?: string; type?: string; inactive?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabaseClient();

  const orgFilter = (sp.org ?? "").trim();
  const outletFilter = (sp.outlet ?? "").trim();
  const typeFilter = (sp.type ?? "all").trim();
  const includeInactive = sp.inactive === "1";

  const planType =
    typeFilter === "diet" || typeFilter === "exercise" ? typeFilter : ("all" as const);

  const { rows, summary, orgs, branches, error } = await loadPlatformProgramPlanCatalog(supabase, {
    orgId: orgFilter || undefined,
    outletId: outletFilter || undefined,
    planType,
    includeInactive,
  });

  const organizations: OrgOption[] = orgs.map((o) => ({ id: o.id, name: o.name }));
  const outlets: OutletOption[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    organization_id: b.organization_id,
  }));

  const defaultOutletId = outlets[0]?.id ?? "";
  const scopeLabels = buildPlatformPlanScopeLabels(rows);

  const dietTemplates = rows.filter((row) => row.plan_type === "diet");
  const exerciseTemplates = rows.filter((row) => row.plan_type === "exercise");

  const showDiet = planType === "all" || planType === "diet";
  const showExercise = planType === "all" || planType === "exercise";

  const filtersForm = (
    <form
      method="GET"
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/60 md:grid-cols-6"
    >
      <label className="flex flex-col gap-1 md:col-span-2">
        Organization
        <select
          defaultValue={orgFilter}
          name="org"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All organizations</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        Branch
        <select
          defaultValue={outletFilter}
          name="outlet"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">All branches</option>
          {outlets.map((o) => {
            const orgName = organizations.find((g) => g.id === o.organization_id)?.name ?? "Org";
            return (
              <option key={o.id} value={o.id}>
                {[o.name, o.city].filter(Boolean).join(" · ") || o.id.slice(0, 8)} ({orgName})
              </option>
            );
          })}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Plan type
        <select
          defaultValue={planType}
          name="type"
          className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="all">Diet + exercise</option>
          <option value="diet">Diet only</option>
          <option value="exercise">Exercise only</option>
        </select>
      </label>
      <label className="flex flex-col justify-end gap-1">
        <span className="flex items-center gap-2">
          <input type="checkbox" name="inactive" value="1" defaultChecked={includeInactive} />
          Include inactive
        </span>
      </label>
      <div className="flex items-end gap-2 md:col-span-6">
        <button
          type="submit"
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Apply filters
        </button>
        <a
          href={ROUTES.superadminProgramPlans}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Reset
        </a>
      </div>
    </form>
  );

  if (error) {
    return (
      <div className="space-y-6">
        <PageIntro />
        {filtersForm}
        <EmptyState title="Unable to load program plans" description={error} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageIntro />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total templates" value={summary.total} hint="Matching current filters" />
        <StatCard label="Diet plans" value={summary.diet} hint="Meal program templates" />
        <StatCard label="Exercise plans" value={summary.exercise} hint="Workout program templates" />
        <StatCard
          label="Scope mix"
          value={`${summary.platformWide} / ${summary.branchScoped}`}
          hint="Platform-wide / branch-scoped"
        />
      </section>

      {filtersForm}

      {!rows.length ? (
        <EmptyState
          title="No program templates yet"
          description="Published program templates will appear here once gyms add them."
        />
      ) : (
        <div className="space-y-12">
          {showDiet ? (
            <ProgramPlansSection
              templates={dietTemplates}
              scopeLabels={scopeLabels}
              defaultOutletId={defaultOutletId}
              planType="diet"
            />
          ) : null}
          {showExercise ? (
            <ProgramPlansSection
              templates={exerciseTemplates}
              scopeLabels={scopeLabels}
              defaultOutletId={defaultOutletId}
              planType="exercise"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function PageIntro() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Program plans</h2>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Diet and exercise program templates across all organizations and branches.
      </p>
    </div>
  );
}

function ProgramPlansSection(props: {
  templates: PlatformProgramPlanTemplateRow[];
  scopeLabels: Record<string, string>;
  defaultOutletId: string;
  planType: "diet" | "exercise";
}) {
  const { templates, scopeLabels, defaultOutletId, planType } = props;
  const isDiet = planType === "diet";

  return (
    <ProgramPlanCatalogClient
      planType={planType}
      templates={templates}
      defaultOutletId={defaultOutletId}
      scopeLabelByTemplateId={scopeLabels}
      title={isDiet ? "Diet plans" : "Exercise plans"}
      description={
        isDiet
          ? "Meal program templates across all organizations. Scope shows whether a template is platform-wide or tied to a branch."
          : "Workout program templates across all organizations. Click a card to inspect weeks, days, and exercises."
      }
    />
  );
}
