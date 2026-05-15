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
