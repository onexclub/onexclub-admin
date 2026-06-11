import {
  organizationFromOutlet,
  type PlatformCustomerMembershipListItem,
} from "@/lib/superadmin/customers-membership-mapper";

/**
 * One row per person on the superadmin "All customers" roster.
 *
 * **Logic:** dedupe `gym_memberships` by `profile_id`. Gym/branch details live in
 * {@link CustomerGymHistoryPanel} on the customer profile — not duplicated in the list.
 *
 * **Reuse:** call {@link buildPlatformCustomerRoster} after fetching filtered memberships.
 */

const STATUS_PRIORITY = ["active", "pending", "suspended", "inactive", "expired"] as const;

export type PlatformCustomerRosterRow = {
  profile_id: string;
  /** Membership used for the profile link and default workspace context. */
  primary_membership_id: string;
  profile: PlatformCustomerMembershipListItem["profile"];
  gym_count: number;
  active_gym_count: number;
  /** Earliest join across all memberships for this person. */
  member_since: string | null;
  /** Display status — Active when any gym membership is active. */
  display_status: string;
  /** Most relevant membership row (for optional summary fields). */
  primary: PlatformCustomerMembershipListItem;
  /** Default gym / branch shown in the roster list. */
  primary_gym_name: string | null;
  primary_branch_name: string | null;
  primary_branch_city: string | null;
  /** Additional gym/branch links beyond the primary (for "+N" in the list). */
  extra_location_count: number;
};

function statusRank(status: string): number {
  const idx = STATUS_PRIORITY.indexOf(status as (typeof STATUS_PRIORITY)[number]);
  return idx === -1 ? STATUS_PRIORITY.length : idx;
}

/** Prefer active (or pending) membership; otherwise the most recently joined row. */
export function pickPrimaryMembership(
  rows: PlatformCustomerMembershipListItem[],
): PlatformCustomerMembershipListItem {
  if (!rows.length) {
    throw new Error("pickPrimaryMembership requires at least one row");
  }

  return [...rows].sort((a, b) => {
    const rankDiff = statusRank(a.status) - statusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    return (b.joined_at ?? "").localeCompare(a.joined_at ?? "");
  })[0]!;
}

export function buildPlatformCustomerRoster(
  memberships: PlatformCustomerMembershipListItem[],
): PlatformCustomerRosterRow[] {
  const byProfile = new Map<string, PlatformCustomerMembershipListItem[]>();

  for (const row of memberships) {
    const bucket = byProfile.get(row.profile_id) ?? [];
    bucket.push(row);
    byProfile.set(row.profile_id, bucket);
  }

  const roster: PlatformCustomerRosterRow[] = [];

  for (const [profileId, rows] of byProfile) {
    const primary = pickPrimaryMembership(rows);
    const org = organizationFromOutlet(primary.outlet);
    const activeGymCount = rows.filter((r) => r.status === "active").length;
    let memberSince: string | null = null;

    for (const row of rows) {
      if (!row.joined_at) continue;
      if (!memberSince || row.joined_at < memberSince) memberSince = row.joined_at;
    }

    roster.push({
      profile_id: profileId,
      primary_membership_id: primary.id,
      profile: primary.profile,
      gym_count: rows.length,
      active_gym_count: activeGymCount,
      member_since: memberSince,
      display_status: activeGymCount > 0 ? "Active" : primary.status,
      primary,
      primary_gym_name: org?.name ?? null,
      primary_branch_name: primary.outlet?.name ?? null,
      primary_branch_city: primary.outlet?.city ?? null,
      extra_location_count: Math.max(0, rows.length - 1),
    });
  }

  return roster.sort((a, b) =>
    (b.primary.joined_at ?? "").localeCompare(a.primary.joined_at ?? ""),
  );
}

export function formatRosterStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    expired: "Expired",
    pending: "Pending",
  };
  return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatExtraLocationsSuffix(extraCount: number): string | null {
  if (extraCount <= 0) return null;
  return `+${extraCount}`;
}
