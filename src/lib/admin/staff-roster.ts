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
