"use server";

import { revalidatePath } from "next/cache";
import { MEMBERSHIP_CATALOG_EDITOR_ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditActorOnInsert } from "@/lib/supabase/audit-columns";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";
import type { BillingCycleDb } from "@/types/database.types";

export type MembershipPlanMutationState = { error?: string; success?: string };

function parseBillingCycle(raw: FormDataEntryValue | null): BillingCycleDb {
  const s = String(raw ?? "monthly").trim();
  const allowed = new Set(["monthly", "quarterly", "half_yearly", "yearly"]);
  if (allowed.has(s)) return s as BillingCycleDb;
  return "monthly";
}

function parseFeaturesJson(formData: FormData): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const raw = String(formData.get("features_json") ?? "").trim();
  if (!raw.length) return { ok: true, value: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null) return { ok: true, value: null };
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Features JSON must be an object such as {\"locker\": true}." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Features JSON must be valid (double-quoted keys recommended)." };
  }
}

type AuthCtx = Awaited<ReturnType<typeof getAuthDashboardContext>>;

function mutationPayload(ctx: AuthCtx, formData: FormData) {
  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!outletId.length) return { error: "Outlet is required." } as const;
  if (!canManageOutletForBranchAdmin(ctx, outletId)) {
    return { error: "You are not authorized to manage plans for that outlet." } as const;
  }

  const featuresResult = parseFeaturesJson(formData);
  if (!featuresResult.ok) return { error: featuresResult.error } as const;

  if (!name.length) return { error: "Plan name is required." } as const;

  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a valid non-negative price." } as const;

  const displayOrderRaw = String(formData.get("display_order") ?? "0").trim();
  const displayOrder = Number(displayOrderRaw);
  const display_order = Number.isFinite(displayOrder) ? Math.trunc(displayOrder) : 0;

  const durationRaw = String(formData.get("duration_days") ?? "").trim();
  const durationDaysNum = durationRaw.length ? Number(durationRaw) : null;
  const duration_days =
    durationDaysNum != null && Number.isFinite(durationDaysNum) && durationDaysNum > 0 ? Math.trunc(durationDaysNum) : null;

  const billing_cycle = parseBillingCycle(formData.get("billing_cycle"));
  const currency = String(formData.get("currency") ?? "INR")
    .trim()
    .toUpperCase()
    .slice(0, 3);
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Currency must be a 3-letter ISO code." } as const;

  const description = String(formData.get("description") ?? "").trim() || null;
  const color_hex = String(formData.get("color_hex") ?? "").trim() || null;
  const allow_cross_branch = formData.get("allow_cross_branch") === "on";
  const cross_branch_org_only = formData.get("cross_branch_org_only") === "on";

  const visitsRaw = String(formData.get("cross_branch_visits_allowed") ?? "").trim();
  let cross_branch_visits_allowed: number | null = null;
  if (allow_cross_branch && visitsRaw.toLowerCase() !== "unlimited" && visitsRaw.length) {
    const n = Number(visitsRaw);
    if (!Number.isFinite(n) || n < 0) {
      return { error: "Cross-branch visits must be a positive number or left blank/unlimited." } as const;
    }
    cross_branch_visits_allowed = Math.trunc(n);
  }

  const cross_branch_quota_period = String(formData.get("cross_branch_quota_period") ?? "monthly").trim().toLowerCase();
  const quota_ok = ["monthly", "total"].includes(cross_branch_quota_period);
  if (!quota_ok) return { error: 'Quota window must be "monthly" or "total".' } as const;

  return {
    outletId,
    name,
    description,
    color_hex,
    display_order,
    price,
    currency,
    billing_cycle,
    duration_days,
    allow_cross_branch,
    cross_branch_visits_allowed: allow_cross_branch ? cross_branch_visits_allowed : null,
    cross_branch_quota_period: allow_cross_branch ? cross_branch_quota_period : "monthly",
    cross_branch_org_only: allow_cross_branch ? cross_branch_org_only : true,
    features_json: featuresResult.value,
  } as const;
}

/**
 * Outlet owners publish catalogue tiers. Omit `plan_id` to insert; send `plan_id` to overwrite an existing SKU.
 */
export async function saveMembershipPlanAction(
  _prev: MembershipPlanMutationState,
  formData: FormData,
): Promise<MembershipPlanMutationState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctx.appRole)) {
    return { error: "Forbidden: catalogue editors are gym owners (or platform superadmins) only." };
  }

  const planId = String(formData.get("plan_id") ?? "").trim();
  const payload = mutationPayload(ctx, formData);
  if ("error" in payload) return { error: payload.error };

  const supabase = await createServerSupabaseClient();

  const rowBody = {
    outlet_id: payload.outletId,
    name: payload.name,
    description: payload.description,
    color_hex: payload.color_hex,
    display_order: payload.display_order,
    price: payload.price,
    currency: payload.currency,
    billing_cycle: payload.billing_cycle,
    duration_days: payload.duration_days,
    allow_cross_branch: payload.allow_cross_branch,
    cross_branch_visits_allowed: payload.cross_branch_visits_allowed,
    cross_branch_quota_period: payload.cross_branch_quota_period,
    cross_branch_org_only: payload.cross_branch_org_only,
    features_json: payload.features_json,
  };

  if (!planId) {
    const { error } = await supabase.from("membership_plans").insert({
      ...rowBody,
      is_active: true,
      ...auditActorOnInsert(ctx.user.id),
    });
    if (error) return { error: error.message };
    revalidatePath(ROUTES.adminPlans);
    revalidatePath(ROUTES.dashboardPlans);
    revalidatePath(ROUTES.adminMemberOnboard);
    revalidatePath(ROUTES.dashboardCustomerNew);
    revalidatePath(ROUTES.dashboardCustomerOnboard);
    revalidatePath(ROUTES.adminCustomers);
    return { success: `Plan “${payload.name}” published.` };
  }

  const { data: existing, error: loadError } = await supabase.from("membership_plans").select("id,outlet_id").eq("id", planId).maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!existing?.outlet_id) return { error: "Plan not found." };
  if (existing.outlet_id !== payload.outletId) return { error: "Cannot move plans between outlets from this editor." };

  const { error } = await supabase.from("membership_plans").update(rowBody).eq("id", planId);

  if (error) return { error: error.message };

  revalidatePath(ROUTES.adminPlans);
  revalidatePath(ROUTES.dashboardPlans);
  revalidatePath(ROUTES.adminMemberOnboard);
  revalidatePath(ROUTES.dashboardCustomerNew);
  revalidatePath(ROUTES.dashboardCustomerOnboard);
  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
  return { success: `Plan “${payload.name}” updated.` };
}

/** @deprecated Prefer {@link saveMembershipPlanAction}; kept for accidental deep imports elsewhere. */
export async function createMembershipPlanAction(prev: MembershipPlanMutationState, formData: FormData) {
  return saveMembershipPlanAction(prev, formData);
}

/** Soft-disable a catalogue row (customers keep historical FK references). */
export async function setMembershipPlanActiveAction(formData: FormData): Promise<void> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctx.appRole)) return;

  const planId = String(formData.get("plan_id") ?? "").trim();
  const isActive = formData.get("is_active") === "true";

  if (!planId) return;

  const supabase = await createServerSupabaseClient();

  const { data: existing, error: loadError } = await supabase.from("membership_plans").select("id,outlet_id").eq("id", planId).maybeSingle();

  if (loadError || !existing?.outlet_id) return;

  if (!canManageOutletForBranchAdmin(ctx, existing.outlet_id)) return;

  const { error } = await supabase.from("membership_plans").update({ is_active: isActive }).eq("id", planId);

  if (error) return;

  revalidatePath(ROUTES.adminPlans);
  revalidatePath(ROUTES.dashboardPlans);
  revalidatePath(ROUTES.adminMemberOnboard);
  revalidatePath(ROUTES.dashboardCustomerNew);
  revalidatePath(ROUTES.dashboardCustomerOnboard);
  revalidatePath(ROUTES.adminCustomers);
  revalidatePath(ROUTES.dashboardCustomers);
}
