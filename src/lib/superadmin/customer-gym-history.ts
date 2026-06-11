import type { SupabaseClient } from "@supabase/supabase-js";

import { ROLES } from "@/lib/auth/roles";

import { firstOrSelf, organizationFromOutlet, type OutletWithOrg } from "@/lib/superadmin/customers-membership-mapper";

/**
 * All gym/branch memberships for one person (`gym_memberships` rows).
 *
 * **Reuse:** superadmin customer workspace — floating customers may have joined multiple gyms over time.
 * Same person keeps one `profiles` row; each branch link is a separate membership row.
 */
export type CustomerGymHistoryRow = {
  id: string;
  status: string;
  outlet_id: string;
  organization_id: string | null;
  joined_at: string | null;
  start_date: string | null;
  end_date: string | null;
  organization_name: string | null;
  branch_name: string | null;
  branch_city: string | null;
  plan_name: string | null;
};

type RawHistoryRow = {
  id: string;
  status: string;
  outlet_id: string;
  joined_at: string | null;
  start_date: string | null;
  end_date: string | null;
  outlet: OutletWithOrg | OutletWithOrg[] | null | unknown;
  membership_plans: { id: string; name: string } | { id: string; name: string }[] | null | unknown;
};

function mapHistoryRow(raw: RawHistoryRow): CustomerGymHistoryRow {
  const outlet = firstOrSelf(raw.outlet as OutletWithOrg | OutletWithOrg[] | null);
  const org = organizationFromOutlet(outlet);
  const plan = firstOrSelf(raw.membership_plans as { name: string } | null);

  return {
    id: raw.id,
    status: raw.status,
    outlet_id: raw.outlet_id,
    organization_id: outlet?.organization_id ?? null,
    joined_at: raw.joined_at,
    start_date: raw.start_date,
    end_date: raw.end_date,
    organization_name: org?.name ?? null,
    branch_name: outlet?.name ?? null,
    branch_city: outlet?.city ?? null,
    plan_name: plan?.name ?? null,
  };
}

/** Newest membership first — includes every branch this profile has joined. */
export async function fetchCustomerGymMembershipHistory(
  supabase: SupabaseClient,
  profileId: string,
): Promise<CustomerGymHistoryRow[]> {
  const { data, error } = await supabase
    .from("gym_memberships")
    .select(
      [
        "id,status,outlet_id,joined_at,start_date,end_date",
        "outlet:outlets(name,city,organization_id,organizations(name,slug))",
        "membership_plans(id,name)",
      ].join(","),
    )
    .eq("profile_id", profileId)
    .eq("role", ROLES.CUSTOMER)
    .is("deleted_at", null)
    .order("joined_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawHistoryRow[]).map(mapHistoryRow);
}
