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

const UTC_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Calendar label for ISO / Postgres timestamps — **SSR-safe** (same string on Node + browser).
 *
 * Do not use `Date#toLocaleDateString()` without a fixed locale here: the server often defaults to `en-US`
 * while the member’s browser may be `en-GB`, which triggers React hydration mismatches (e.g. 5/15/2026 vs 15/05/2026).
 */
export function formatMembershipTimestampUtcLabel(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getUTCDate();
  const mon = UTC_MONTH_SHORT[d.getUTCMonth()];
  const y = d.getUTCFullYear();
  return `${day} ${mon} ${y}`;
}
