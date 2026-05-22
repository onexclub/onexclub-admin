/**
 * Audit actor display for `gym_memberships` detail pages (`022_audit_tracking.sql`).
 * “Onboarded by” reads `gym_memberships.created_by` — not `profiles.created_by`.
 *
 * **Reuse:** append `GYM_MEMBERSHIP_AUDIT_EMBEDS` to `.select()` on membership detail routes,
 * then `mapGymMembershipAuditFromRow()` when building `CustomerMembershipDetailMembership` (`membership-detail.ts`).
 */

export type MembershipAuditProfileLite = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

/** Shown in Overview — “Onboarded by” / “Last updated by”. */
export type MembershipAuditDisplay = {
  onboardedByLabel: string;
  /** True when only legacy `onboarded_by` was populated (pre-022 backfill). */
  onboardedByLegacyOnly: boolean;
  lastUpdatedByLabel: string;
  updatedAt: string | null;
};

/** PostgREST embed fragment — requires migration `022_audit_tracking.sql`. */
export const GYM_MEMBERSHIP_AUDIT_EMBEDS = [
  "created_by",
  "updated_by",
  "updated_at",
  "onboarded_by",
  "created_by_staff:profiles!gym_memberships_created_by_fkey(full_name,email,phone)",
  "updated_by_staff:profiles!gym_memberships_updated_by_fkey(full_name,email,phone)",
  "onboarded_by_staff:profiles!gym_memberships_onboarded_by_fkey(full_name,email,phone)",
].join(",");

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function formatMembershipAuditActorLabel(profile: MembershipAuditProfileLite | null | undefined): string {
  if (!profile) return "—";
  const name = profile.full_name?.trim();
  if (name) return name;
  const email = profile.email?.trim();
  if (email) return email;
  const phone = profile.phone?.trim();
  if (phone) return phone;
  return "—";
}

type RawAuditRow = {
  created_by?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  onboarded_by?: string | null;
  created_by_staff?: MembershipAuditProfileLite | MembershipAuditProfileLite[] | null;
  updated_by_staff?: MembershipAuditProfileLite | MembershipAuditProfileLite[] | null;
  onboarded_by_staff?: MembershipAuditProfileLite | MembershipAuditProfileLite[] | null;
};

/** Maps joined staff profiles into human-readable Overview labels. */
export function mapGymMembershipAuditFromRow(raw: RawAuditRow): MembershipAuditDisplay {
  const createdStaff = firstOrSelf(raw.created_by_staff);
  const onboardedStaff = firstOrSelf(raw.onboarded_by_staff);
  const updatedStaff = firstOrSelf(raw.updated_by_staff);

  const createdLabel = formatMembershipAuditActorLabel(createdStaff);
  const onboardedLabel = formatMembershipAuditActorLabel(onboardedStaff);
  const hasCreated = createdLabel !== "—" || Boolean(raw.created_by);
  const hasOnboarded = onboardedLabel !== "—" || Boolean(raw.onboarded_by);

  let onboardedByLabel = "Not recorded";
  let onboardedByLegacyOnly = false;

  if (createdLabel !== "—") {
    onboardedByLabel = createdLabel;
  } else if (onboardedLabel !== "—") {
    onboardedByLabel = onboardedLabel;
    onboardedByLegacyOnly = !hasCreated && hasOnboarded;
  } else if (raw.created_by || raw.onboarded_by) {
    onboardedByLabel = "Staff member";
    onboardedByLegacyOnly = Boolean(raw.onboarded_by) && !raw.created_by;
  }

  const lastUpdatedByLabel = formatMembershipAuditActorLabel(updatedStaff);

  return {
    onboardedByLabel,
    onboardedByLegacyOnly,
    lastUpdatedByLabel: lastUpdatedByLabel !== "—" ? lastUpdatedByLabel : raw.updated_by ? "Staff member" : "—",
    updatedAt: raw.updated_at ?? null,
  };
}
