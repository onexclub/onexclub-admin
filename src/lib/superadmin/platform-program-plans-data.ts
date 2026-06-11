import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProgramPlanTemplateListItem } from "@/lib/admin/program-plan-templates";
import type { CustomerProgramPlanType } from "@/lib/customers/customer-program-plans";

import {
  loadPlatformOrgsAndBranches,
  type PlatformBranchRow,
  type PlatformOrgRow,
} from "@/lib/superadmin/platform-gyms-data";

/**
 * Superadmin: platform-wide diet & exercise program templates (`plan_templates`).
 *
 * **Reuse:** import these loaders from any superadmin Server Component that needs the full
 * catalogue across tenants. Gym branch consoles should keep using
 * {@link fetchProgramPlanTemplates} in `@/lib/admin/program-plan-templates` (outlet-scoped).
 *
 * **Data model:** templates live in `plan_templates` (not legacy `diet_plans` / `exercise_plans`
 * member assignment rows). `outlet_id = null` means platform-wide; otherwise branch-scoped.
 */

/** Same columns as `fetchProgramPlanTemplates` — keep in sync when extending list views. */
const PROGRAM_PLAN_TEMPLATE_SELECT = [
  "id",
  "outlet_id",
  "plan_type",
  "name",
  "description",
  "difficulty_level",
  "duration_weeks",
  "primary_goal",
  "target_gender",
  "min_age",
  "max_age",
  "min_score",
  "max_score",
  "tags",
  "is_active",
].join(",");

export type PlatformProgramPlanTemplateRow = ProgramPlanTemplateListItem & {
  organization_id: string | null;
  organization_name: string | null;
  branch_name: string | null;
  branch_city: string | null;
};

export type PlatformProgramPlanFilters = {
  orgId?: string;
  outletId?: string;
  planType?: CustomerProgramPlanType | "all";
  /** When false (default), hide inactive templates. */
  includeInactive?: boolean;
};

export type PlatformProgramPlanSummary = {
  total: number;
  diet: number;
  exercise: number;
  platformWide: number;
  branchScoped: number;
  inactive: number;
};

/** Human label for catalogue cards — org · branch · city, or platform-wide. */
export function formatPlatformPlanScopeLabel(row: PlatformProgramPlanTemplateRow): string {
  if (!row.outlet_id) return "Platform-wide";
  const parts = [row.organization_name, row.branch_name, row.branch_city].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Branch template";
}

/** Attach org/branch names using the same org + branch tree as the platform dashboard. */
export function enrichProgramPlanTemplates(
  templates: ProgramPlanTemplateListItem[],
  orgs: PlatformOrgRow[],
  branches: PlatformBranchRow[],
): PlatformProgramPlanTemplateRow[] {
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name] as const));
  const branchById = new Map(branches.map((b) => [b.id, b] as const));

  return templates.map((template) => {
    const branch = template.outlet_id ? branchById.get(template.outlet_id) : null;
    const organizationId = branch?.organization_id ?? null;

    return {
      ...template,
      organization_id: organizationId,
      organization_name: organizationId ? (orgNameById.get(organizationId) ?? null) : null,
      branch_name: branch?.name ?? null,
      branch_city: branch?.city ?? null,
    };
  });
}

/** Load every non-deleted program template visible to superadmin RLS. */
export async function fetchAllPlatformProgramPlanTemplates(
  supabase: SupabaseClient,
  params: { includeInactive?: boolean } = {},
): Promise<{ rows: ProgramPlanTemplateListItem[]; error: string | null }> {
  const { includeInactive = false } = params;

  let query = supabase
    .from("plan_templates")
    .select(PROGRAM_PLAN_TEMPLATE_SELECT)
    .is("deleted_at", null)
    .order("plan_type", { ascending: true })
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };

  return { rows: (data ?? []) as unknown as ProgramPlanTemplateListItem[], error: null };
}

/**
 * One-shot loader: templates + org/branch enrichment for superadmin roster pages.
 *
 * Reuse: pass `filters` from URL search params on `/superadmin/program-plans`.
 */
export async function loadPlatformProgramPlanCatalog(
  supabase: SupabaseClient,
  filters: PlatformProgramPlanFilters = {},
): Promise<{
  rows: PlatformProgramPlanTemplateRow[];
  summary: PlatformProgramPlanSummary;
  orgs: PlatformOrgRow[];
  branches: PlatformBranchRow[];
  error: string | null;
}> {
  const [{ rows: rawRows, error }, tree] = await Promise.all([
    fetchAllPlatformProgramPlanTemplates(supabase, {
      includeInactive: filters.includeInactive,
    }),
    loadPlatformOrgsAndBranches(supabase),
  ]);

  if (error) {
    return {
      rows: [],
      summary: emptyPlatformProgramPlanSummary(),
      orgs: tree.orgs,
      branches: tree.branches,
      error,
    };
  }

  const enriched = enrichProgramPlanTemplates(rawRows, tree.orgs, tree.branches);
  const filtered = filterPlatformProgramPlanTemplates(enriched, filters);

  return {
    rows: filtered,
    summary: summarizePlatformProgramPlans(filtered),
    orgs: tree.orgs,
    branches: tree.branches,
    error: null,
  };
}

export function filterPlatformProgramPlanTemplates(
  rows: PlatformProgramPlanTemplateRow[],
  filters: PlatformProgramPlanFilters,
): PlatformProgramPlanTemplateRow[] {
  const planType = filters.planType ?? "all";
  const orgId = filters.orgId?.trim() ?? "";
  const outletId = filters.outletId?.trim() ?? "";

  return rows.filter((row) => {
    if (planType !== "all" && row.plan_type !== planType) return false;

    if (outletId.length) {
      return row.outlet_id === outletId;
    }

    if (orgId.length) {
      if (!row.outlet_id) return false;
      return row.organization_id === orgId;
    }

    return true;
  });
}

export function summarizePlatformProgramPlans(rows: PlatformProgramPlanTemplateRow[]): PlatformProgramPlanSummary {
  let diet = 0;
  let exercise = 0;
  let platformWide = 0;
  let branchScoped = 0;
  let inactive = 0;

  for (const row of rows) {
    if (row.plan_type === "diet") diet += 1;
    if (row.plan_type === "exercise") exercise += 1;
    if (row.outlet_id) branchScoped += 1;
    else platformWide += 1;
    if (!row.is_active) inactive += 1;
  }

  return {
    total: rows.length,
    diet,
    exercise,
    platformWide,
    branchScoped,
    inactive,
  };
}

function emptyPlatformProgramPlanSummary(): PlatformProgramPlanSummary {
  return { total: 0, diet: 0, exercise: 0, platformWide: 0, branchScoped: 0, inactive: 0 };
}

/** Build `scopeLabelByTemplateId` for {@link ProgramPlanCatalogClient} on superadmin pages. */
export function buildPlatformPlanScopeLabels(
  rows: PlatformProgramPlanTemplateRow[],
): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.id, formatPlatformPlanScopeLabel(row)]));
}
