import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin-console helpers for outlet-scoped `membership_plans`.
 *
 * Reuse entry points:
 * - `src/app/admin/plans/page.tsx` — catalogue view + CRUD wrappers
 * - `src/app/admin/members/onboard/page.tsx` — hydrate plan choices per outlet when creating members
 * - `src/app/admin/customers/page.tsx` (+ assign form) — renew / attach plan after offline payment
 *
 * The Supabase DDL lives in `supabase/migrations/004_membership_plans.sql`; keep API shapes aligned with that migration.
 * Customer-facing perk bullets reuse `buildPlanBenefitLines()` in `@/lib/admin/plan-benefits.ts` — tweak there to refresh every surface at once.
 */

export type MembershipPlanAdminRow = {
  id: string;
  outlet_id: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  is_active: boolean;
  display_order: number;
  price: number;
  currency: string;
  billing_cycle: string;
  duration_days: number | null;
  allow_cross_branch: boolean;
  cross_branch_visits_allowed: number | null;
  cross_branch_quota_period: string;
  cross_branch_org_only: boolean;
  features_json: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchMembershipPlansForOutlets(args: {
  supabase: SupabaseClient;
  outletIds: string[];
  /** When false (default), only plans ready for sale/onboarding (`is_active`). */
  includeInactive?: boolean;
}): Promise<{ rows: MembershipPlanAdminRow[]; error: string | null }> {
  const { supabase, outletIds, includeInactive } = args;
  if (!outletIds.length) return { rows: [], error: null };

  let query = supabase
    .from("membership_plans")
    .select(
      [
        "id",
        "outlet_id",
        "name",
        "description",
        "color_hex",
        "is_active",
        "display_order",
        "price",
        "currency",
        "billing_cycle",
        "duration_days",
        "allow_cross_branch",
        "cross_branch_visits_allowed",
        "cross_branch_quota_period",
        "cross_branch_org_only",
        "features_json",
        "created_at",
      ].join(","),
    )
    .in("outlet_id", outletIds)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };

  return { rows: (data ?? []) as unknown as MembershipPlanAdminRow[], error: null };
}
