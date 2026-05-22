import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Superadmin platform dashboard: organizations ("gym brands") and their branches (`outlets` rows).
 *
 * Reuse: import these loaders from any superadmin Server Component that needs the same tree or
 * member counts. DB table remains `outlets`; UI copy uses "branch" / "Gym branch".
 */

export type PlatformBranchRow = {
  id: string;
  organization_id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
};

export type PlatformOrgRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan_tier: string;
  logo_url: string | null;
};

export async function loadActiveMemberCountByOutletId(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data: rows } = await supabase
    .from("gym_memberships")
    .select("outlet_id")
    .eq("status", "active")
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const id = String((row as { outlet_id: string }).outlet_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function loadPlatformOrgsAndBranches(supabase: SupabaseClient): Promise<{
  orgs: PlatformOrgRow[];
  branches: PlatformBranchRow[];
  memberCountByOutletId: Map<string, number>;
}> {
  const [{ data: orgs }, { data: branches }, memberCountByOutletId] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,slug,is_active,plan_tier,logo_url")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("outlets")
      .select("id,organization_id,name,city,state,country,address,phone,is_active")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    loadActiveMemberCountByOutletId(supabase),
  ]);

  return {
    orgs: (orgs ?? []) as PlatformOrgRow[],
    branches: (branches ?? []) as PlatformBranchRow[],
    memberCountByOutletId,
  };
}

export function branchesForOrg(orgId: string, branches: PlatformBranchRow[]): PlatformBranchRow[] {
  return branches.filter((b) => b.organization_id === orgId);
}

export function formatPlanTierLabel(planTier: string): string {
  return planTier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One row per organization for bar charts (name truncated in UI if needed). */
export type PlatformOrgMetricRow = {
  name: string;
  members: number;
  branches: number;
};

export type PlatformPlanTierSlice = {
  tier: string;
  count: number;
};

export type PlatformTopBranchRow = {
  name: string;
  members: number;
  orgName: string;
};

/**
 * Serializable chart/report model for the platform dashboard (`PlatformDashboardCharts`).
 *
 * Reuse: call from any Server Component that already loaded orgs/branches/member counts
 * (same inputs as `PlatformGymsTree`) to avoid duplicating aggregation logic.
 */
export function buildPlatformDashboardChartModel(
  orgs: PlatformOrgRow[],
  branches: PlatformBranchRow[],
  memberCountByOutletId: Map<string, number>,
): {
  orgMetrics: PlatformOrgMetricRow[];
  planTiers: PlatformPlanTierSlice[];
  topBranches: PlatformTopBranchRow[];
} {
  const orgMetrics: PlatformOrgMetricRow[] = orgs.map((org) => {
    const orgBranches = branchesForOrg(org.id, branches);
    const members = orgBranches.reduce((sum, b) => sum + (memberCountByOutletId.get(b.id) ?? 0), 0);
    return { name: org.name, members, branches: orgBranches.length };
  });

  const tierAcc = new Map<string, number>();
  for (const org of orgs) {
    const label = formatPlanTierLabel(org.plan_tier);
    tierAcc.set(label, (tierAcc.get(label) ?? 0) + 1);
  }
  const planTiers: PlatformPlanTierSlice[] = Array.from(tierAcc.entries()).map(([tier, count]) => ({
    tier,
    count,
  }));

  const orgNameById = new Map(orgs.map((o) => [o.id, o.name] as const));
  const topBranches: PlatformTopBranchRow[] = branches
    .map((b) => ({
      name: b.name,
      members: memberCountByOutletId.get(b.id) ?? 0,
      orgName: orgNameById.get(b.organization_id) ?? "—",
    }))
    .sort((a, b) => b.members - a.members)
    .slice(0, 12);

  return { orgMetrics, planTiers, topBranches };
}
