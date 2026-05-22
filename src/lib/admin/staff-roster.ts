import type { SupabaseClient } from "@supabase/supabase-js";

/** Shape returned from `STAFF_ROSTER_SELECT` profile embed. */
export type StaffRosterProfileEmbed = {
  id?: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

export type StaffRosterRow = {
  id: string;
  profile_id: string;
  outlet_id: string;
  role: string;
  is_primary: boolean;
  invite_pending?: boolean | null;
  assigned_at: string | null;
  profile?: StaffRosterProfileEmbed | StaffRosterProfileEmbed[] | null;
  /** Legacy embed key — keep while old selects roll off. */
  profiles?: StaffRosterProfileEmbed | StaffRosterProfileEmbed[] | null;
  outlet?: { name: string | null; city: string | null } | { name: string | null; city: string | null }[] | null;
  outlets?: { name: string | null; city: string | null } | { name: string | null; city: string | null }[] | null;
};

/**
 * PostgREST select for `/dashboard/staff` roster rows.
 *
 * **Reuse:** `profile:profiles!profile_id` matches `/dashboard/customers` embed style (not `profiles!…_fkey`).
 */
export const STAFF_ROSTER_SELECT = [
  "id",
  "profile_id",
  "outlet_id",
  "role",
  "is_primary",
  "invite_pending",
  "assigned_at",
  "profile:profiles!profile_id(id,email,full_name,phone,avatar_url)",
  "outlet:outlets!outlet_id(name,city)",
].join(",");

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Reads embedded profile from either `profile` or legacy `profiles` key. */
export function staffProfileFromRow(row: Pick<StaffRosterRow, "profile" | "profiles">): StaffRosterProfileEmbed | null {
  return firstOrSelf(row.profile) ?? firstOrSelf(row.profiles);
}

export function staffOutletFromRow(row: Pick<StaffRosterRow, "outlet" | "outlets">) {
  return firstOrSelf(row.outlet) ?? firstOrSelf(row.outlets);
}

/**
 * Service-role fallback when RLS hides `profiles.full_name` on embedded joins.
 * Call only after the caller has verified outlet scope for the roster rows.
 */
export async function fetchStaffProfilesByIds(
  adminClient: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, StaffRosterProfileEmbed>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  if (!unique.length) return new Map();

  const { data, error } = await adminClient
    .from("profiles")
    .select("id,email,full_name,phone,avatar_url")
    .in("id", unique);

  if (error || !data?.length) return new Map();

  return new Map(
    data.map((p) => [
      p.id,
      {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        avatar_url: p.avatar_url,
      },
    ]),
  );
}

/** Prefer embedded profile; fall back to service-role map by `profile_id`. */
export function resolveStaffRosterProfile(
  row: StaffRosterRow,
  profileById: Map<string, StaffRosterProfileEmbed>,
): StaffRosterProfileEmbed | null {
  const embedded = staffProfileFromRow(row);
  if (embedded?.full_name?.trim() || embedded?.email) return embedded;
  return profileById.get(row.profile_id) ?? embedded;
}

/** One roster line per `profile_id` — detail link uses primary (or newest) assignment. */
export type StaffRosterGroupedEntry = {
  profileId: string;
  detailAssignmentId: string;
  assignments: StaffRosterRow[];
  role: string;
  invitePending: boolean;
};

function assignmentSortKey(row: StaffRosterRow): number {
  return row.assigned_at ? Date.parse(row.assigned_at) : 0;
}

/**
 * Collapses multiple `staff_assignments` rows for the same person into one roster entry.
 *
 * **Reuse:** `/dashboard/staff` table — branch names come from `staffRosterBranchLines`.
 */
export function groupStaffRosterByProfile(rows: StaffRosterRow[]): StaffRosterGroupedEntry[] {
  const byProfile = new Map<string, StaffRosterRow[]>();
  for (const row of rows) {
    const list = byProfile.get(row.profile_id) ?? [];
    list.push(row);
    byProfile.set(row.profile_id, list);
  }

  const grouped = [...byProfile.entries()].map(([profileId, assignments]) => {
    const sorted = [...assignments].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return assignmentSortKey(b) - assignmentSortKey(a);
    });
    const lead = sorted[0]!;
    return {
      profileId,
      detailAssignmentId: lead.id,
      assignments: sorted,
      role: lead.role,
      invitePending: assignments.some((a) => !!a.invite_pending),
    };
  });

  return grouped.sort((a, b) => {
    const latest = (g: StaffRosterGroupedEntry) =>
      Math.max(0, ...g.assignments.map((r) => assignmentSortKey(r)));
    return latest(b) - latest(a);
  });
}

/** Human-readable branch lines for the roster Branch column (primary listed first). */
export function staffRosterBranchLines(
  assignments: StaffRosterRow[],
): { outletId: string; label: string; isPrimary: boolean }[] {
  return assignments.map((row) => {
    const outlet = staffOutletFromRow(row);
    const name = outlet?.name ?? "Branch";
    const label = outlet?.city?.length ? `${name} · ${outlet.city}` : name;
    return { outletId: row.outlet_id, label, isPrimary: row.is_primary };
  });
}
