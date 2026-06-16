import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLES } from "@/types/roles";

/**
 * Ensures every `gym_owner` already scoped to this organization gets a `staff_assignments`
 * row for `outletId`.
 *
 * **Why this exists (reusability / moderation):**
 * - RLS `i_manage_outlet()` already treats `gym_owner` as org-wide for writes, but
 *   `my_staff_outlet_ids()` (and helpers like `i_can_see_member()` that depend on it)
 *   only list outlets with an explicit assignment.
 * - Without linking new branches to the owner profile, cross-branch member profile reads
 *   can fail even though the owner “should” see all locations.
 * - Call this after **creating** a branch or as a **repair** after **editing** (legacy rows).
 *
 * **Idempotent:** skips profiles that already have `(profile_id, outlet_id)`.
 */
export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function syncGymOwnerAssignmentsForOutlet(
  supabase: ServerSupabase,
  organizationId: string,
  outletId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: orgOutlets, error: orgOutletsErr } = await supabase
    .from("outlets")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (orgOutletsErr) {
    return { ok: false, message: orgOutletsErr.message };
  }

  const orgOutletIds = (orgOutlets ?? []).map((r) => r.id).filter(Boolean);
  if (!orgOutletIds.length) {
    return { ok: true };
  }

  const { data: ownerRows, error: ownersErr } = await supabase
    .from("staff_assignments")
    .select("profile_id")
    .eq("role", ROLES.GYM_OWNER)
    .is("revoked_at", null)
    .in("outlet_id", orgOutletIds);

  if (ownersErr) {
    return { ok: false, message: ownersErr.message };
  }

  const ownerProfileIds = [
    ...new Set((ownerRows ?? []).map((r) => r.profile_id).filter((id): id is string => Boolean(id))),
  ];

  if (!ownerProfileIds.length) {
    return { ok: true };
  }

  /**
   * Upsert (not insert-only): `reassignGymOwnerAction` revokes every org owner row first.
   * A revoked `(profile_id, outlet_id)` row still satisfies UNIQUE — insert would fail or be
   * skipped if we only check `profile_id` presence. Always clear `revoked_at` on sync.
   */
  for (const profile_id of ownerProfileIds) {
    const { error: upsertErr } = await supabase.from("staff_assignments").upsert(
      {
        profile_id,
        outlet_id: outletId,
        role: ROLES.GYM_OWNER,
        is_primary: false,
        revoked_at: null,
      },
      { onConflict: "profile_id,outlet_id" },
    );

    if (upsertErr) {
      return { ok: false, message: upsertErr.message };
    }
  }

  return { ok: true };
}
