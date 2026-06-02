"use server";

import { fetchProgramPlanTemplateDetail } from "@/lib/customers/program-plan-template-detail";
import { canViewCustomerProgramPlans, hasAccess } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";

export type LoadProgramPlanDetailState = {
  error?: string;
  detail?: Awaited<ReturnType<typeof fetchProgramPlanTemplateDetail>>;
};

/** Lazy-load full plan template for the detail modal (weeks → days → meals/exercises). */
export async function loadProgramPlanTemplateDetailAction(
  _prev: LoadProgramPlanDetailState,
  formData: FormData,
): Promise<LoadProgramPlanDetailState> {
  const ctx = await getAuthDashboardContext();
  const canView =
    canViewCustomerProgramPlans(ctx.appRole) ||
    hasAccess(ctx.appRole, "diet_plans", "read") ||
    hasAccess(ctx.appRole, "exercise_plans", "read");
  if (!ctx.user || !canView) {
    return { error: "Forbidden." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim();
  const outletId = String(formData.get("outlet_id") ?? "").trim();
  if (!templateId) return { error: "Missing plan." };

  if (outletId && !canManageOutletForBranchAdmin(ctx, outletId)) {
    return { error: "You cannot view plans for that branch." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const detail = await fetchProgramPlanTemplateDetail(supabase, templateId);
    if (!detail) return { error: "Plan template not found." };
    return { detail };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not load plan details." };
  }
}
