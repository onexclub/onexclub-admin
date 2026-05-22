import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLES } from "@/lib/auth/roles";
import type { TrainerLite } from "@/lib/customers/membership-detail";

/**
 * Coaches (`staff_assignments.role = trainer`) for one or more outlets.
 * **Reuse:** customer roster, onboard wizard review, membership profile workspace.
 */
export async function listTrainersForOutlets(
  supabase: SupabaseClient,
  outletIds: string[],
): Promise<TrainerLite[]> {
  if (!outletIds.length) return [];

  const { data } = await supabase
    .from("staff_assignments")
    .select("profile_id, outlet_id, profiles!staff_assignments_profile_id_fkey(full_name,email)")
    .in("outlet_id", outletIds)
    .eq("role", ROLES.TRAINER)
    .is("revoked_at", null);

  type Row = {
    profile_id: string;
    outlet_id: string;
    profiles: { full_name: string | null; email: string | null } | null | unknown[];
  };

  const byProfile = new Map<string, TrainerLite>();
  for (const row of (data ?? []) as Row[]) {
    const nestedUnknown = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const nested = nestedUnknown as { full_name?: string | null; email?: string | null } | null | undefined;
    byProfile.set(row.profile_id, {
      id: row.profile_id,
      full_name: nested?.full_name ?? null,
      email: nested?.email ?? null,
    });
  }

  return [...byProfile.values()];
}

/** Trainers assigned to a single outlet — used when filtering roster assign dropdowns. */
export async function listTrainersForOutlet(
  supabase: SupabaseClient,
  outletId: string,
): Promise<TrainerLite[]> {
  return listTrainersForOutlets(supabase, [outletId]);
}

export function trainerDisplayLabel(trainer: TrainerLite | null | undefined): string {
  if (!trainer) return "—";
  return trainer.full_name?.trim() || trainer.email?.trim() || "Coach";
}

/** Group trainers by outlet for roster rows (trainers may cover multiple branches). */
export async function listTrainersGroupedByOutlet(
  supabase: SupabaseClient,
  outletIds: string[],
): Promise<Map<string, TrainerLite[]>> {
  if (!outletIds.length) return new Map();

  const { data } = await supabase
    .from("staff_assignments")
    .select("profile_id, outlet_id, profiles!staff_assignments_profile_id_fkey(full_name,email)")
    .in("outlet_id", outletIds)
    .eq("role", ROLES.TRAINER)
    .is("revoked_at", null);

  type Row = {
    profile_id: string;
    outlet_id: string;
    profiles: { full_name: string | null; email: string | null } | null | unknown[];
  };

  const grouped = new Map<string, Map<string, TrainerLite>>();

  for (const row of (data ?? []) as Row[]) {
    const nestedUnknown = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const nested = nestedUnknown as { full_name?: string | null; email?: string | null } | null | undefined;
    const lite: TrainerLite = {
      id: row.profile_id,
      full_name: nested?.full_name ?? null,
      email: nested?.email ?? null,
    };
    if (!grouped.has(row.outlet_id)) grouped.set(row.outlet_id, new Map());
    grouped.get(row.outlet_id)!.set(row.profile_id, lite);
  }

  const result = new Map<string, TrainerLite[]>();
  for (const [outletId, map] of grouped) {
    result.set(outletId, [...map.values()]);
  }
  return result;
}

export function trainersForOutletFromGrouped(
  grouped: Map<string, TrainerLite[]>,
  outletId: string,
): TrainerLite[] {
  return grouped.get(outletId) ?? [];
}
