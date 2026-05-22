/**
 * Normalizes Supabase `gym_memberships` rows with nested joins for the platform customer roster.
 *
 * **Reuse / moderation:**
 * The same nested select shape (`profile`, `outlet`, `membership_plans`) is duplicated in:
 * - `src/app/dashboard/customers/page.tsx` → `toMembershipListItem`
 * - `src/app/admin/customers/page.tsx`
 *
 * If you add columns or change embeds, update those call sites **and** this mapper together (or consolidate into one shared module later).
 */

export type OrgLite = { name: string | null; slug: string | null };

export type OutletWithOrg = {
  name: string | null;
  city: string | null;
  organization_id: string | null;
  organizations: OrgLite | OrgLite[] | null | unknown;
};

export type PlatformCustomerMembershipListItem = {
  id: string;
  status: string;
  outlet_id: string;
  profile_id: string;
  assigned_trainer_id: string | null;
  onboarded_by: string | null;
  joined_at: string | null;
  plan_id: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_paid: number | null;
  currency: string | null;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  outlet: OutletWithOrg | null;
  plan: { id: string; name: string } | null;
};

export function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function organizationFromOutlet(outlet: OutletWithOrg | null): OrgLite | null {
  if (!outlet?.organizations) return null;
  return firstOrSelf(outlet.organizations as OrgLite | OrgLite[] | null);
}

/** Maps a raw PostgREST row into a typed list row (platform + dashboard-compatible fields). */
export function toPlatformMembershipListItem(raw: unknown): PlatformCustomerMembershipListItem {
  const r = raw as {
    id: string;
    status: string;
    outlet_id: string;
    profile_id: string;
    assigned_trainer_id?: string | null;
    onboarded_by: string | null;
    joined_at: string | null;
    plan_id: string | null;
    start_date: string | null;
    end_date: string | null;
    amount_paid: number | null;
    currency: string | null;
    profile:
      | { full_name: string | null; email: string | null; phone: string | null }
      | null
      | unknown[]
      | unknown;
    outlet: OutletWithOrg | null | unknown[] | unknown;
    membership_plans: { id: string; name: string } | null | unknown[] | unknown;
  };

  return {
    id: r.id,
    status: r.status,
    outlet_id: r.outlet_id,
    profile_id: r.profile_id,
    assigned_trainer_id: r.assigned_trainer_id ?? null,
    onboarded_by: r.onboarded_by,
    joined_at: r.joined_at,
    plan_id: r.plan_id,
    start_date: r.start_date,
    end_date: r.end_date,
    amount_paid: r.amount_paid,
    currency: r.currency,
    profile: firstOrSelf(r.profile as never),
    outlet: firstOrSelf(r.outlet as never),
    plan: firstOrSelf(r.membership_plans as never),
  };
}
