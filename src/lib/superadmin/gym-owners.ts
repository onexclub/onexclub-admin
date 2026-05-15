import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLES } from "@/types/roles";

/**
 * Superadmin helpers: who owns / operates a gym brand (`gym_owner` on `staff_assignments`).
 *
 * **Reuse:** Call `loadOrganizationGymOwners` from any superadmin Server Component that needs
 * owner identity without duplicating outlet → assignment → profile joins.
 */

export type OrganizationGymOwner = {
  profile_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  /** True when at least one active assignment row has `is_primary`. */
  is_primary: boolean;
  /** Distinct branch names this owner is linked to (explicit `staff_assignments` rows). */
  branch_names: string[];
  outlet_ids: string[];
};

export async function loadOrganizationGymOwners(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationGymOwner[]> {
  const { data: outlets } = await supabase
    .from("outlets")
    .select("id,name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  const outletRows = outlets ?? [];
  const outletIds = outletRows.map((o) => o.id);
  if (!outletIds.length) return [];

  const outletNameById = new Map(outletRows.map((o) => [o.id, o.name as string]));

  const { data: assignments } = await supabase
    .from("staff_assignments")
    .select("profile_id,outlet_id,is_primary,profiles(full_name,email,phone)")
    .eq("role", ROLES.GYM_OWNER)
    .is("revoked_at", null)
    .in("outlet_id", outletIds);

  const byProfile = new Map<string, OrganizationGymOwner>();

  for (const row of assignments ?? []) {
    const profileId = String(row.profile_id);
    const profRaw = row.profiles;
    const prof = Array.isArray(profRaw) ? profRaw[0] : profRaw;
    const email = prof && typeof prof === "object" && "email" in prof ? String((prof as { email: string }).email) : "";
    const fullName =
      prof && typeof prof === "object" && "full_name" in prof
        ? ((prof as { full_name: string | null }).full_name ?? null)
        : null;
    const phone =
      prof && typeof prof === "object" && "phone" in prof ? ((prof as { phone: string | null }).phone ?? null) : null;

    const branchName = outletNameById.get(String(row.outlet_id)) ?? "Branch";
    const existing = byProfile.get(profileId);
    if (!existing) {
      byProfile.set(profileId, {
        profile_id: profileId,
        full_name: fullName,
        email,
        phone,
        is_primary: Boolean(row.is_primary),
        branch_names: [branchName],
        outlet_ids: [String(row.outlet_id)],
      });
      continue;
    }
    if (row.is_primary) existing.is_primary = true;
    if (!existing.outlet_ids.includes(String(row.outlet_id))) {
      existing.outlet_ids.push(String(row.outlet_id));
      existing.branch_names.push(branchName);
    }
  }

  return [...byProfile.values()].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email);
  });
}
