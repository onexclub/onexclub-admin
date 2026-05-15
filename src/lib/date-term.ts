/**
 * Compute an ISO calendar date (`YYYY-MM-DD`) by adding whole days from a DATE string.
 * Uses UTC noon anchors to dodge local timezone flips near midnight.
 *
 * Shared by member onboarding / renew flows when `membership_plans.duration_days`
 * derives `gym_memberships.end_date` for fixed-term memberships.
 */

export function addDaysFromIsoDate(startYmd: string, daysToAdd: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startYmd.trim());
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);

  const d = new Date(Date.UTC(y, mo, da));
  if (Number.isNaN(d.getTime())) return null;

  d.setUTCDate(d.getUTCDate() + daysToAdd);
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function todayUtcIsoDate(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
