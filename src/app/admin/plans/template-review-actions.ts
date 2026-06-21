"use server";

import { revalidatePath } from "next/cache";

import {
  approveTemplate,
  fetchPendingReviewTemplates,
  rejectTemplate,
} from "@/lib/plans/template-matching/admin-review";
import { canAssignCustomerProgramPlans } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

export type TemplateReviewState = { error?: string; success?: string };

/** Pending AI templates for staff review queue (both diet + exercise). */
export async function loadPendingReviewTemplatesAction() {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canAssignCustomerProgramPlans(ctx.appRole)) {
    return { rows: [], error: "Permission denied." };
  }

  const supabase = await createServerSupabaseClient();
  return fetchPendingReviewTemplates(supabase);
}

export async function approveTemplateAction(
  _prev: TemplateReviewState,
  formData: FormData,
): Promise<TemplateReviewState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canAssignCustomerProgramPlans(ctx.appRole)) {
    return { error: "Permission denied." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) return { error: "Missing template id." };

  const supabase = createServiceRoleSupabaseClient();
  const { error } = await approveTemplate(supabase, templateId, ctx.user.id);
  if (error) return { error };

  revalidatePath(ROUTES.dashboardDiet);
  revalidatePath(ROUTES.dashboardExercise);
  return { success: "Template approved and active for matching." };
}

export async function rejectTemplateAction(
  _prev: TemplateReviewState,
  formData: FormData,
): Promise<TemplateReviewState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canAssignCustomerProgramPlans(ctx.appRole)) {
    return { error: "Permission denied." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) return { error: "Missing template id." };

  const supabase = createServiceRoleSupabaseClient();
  const { error } = await rejectTemplate(supabase, templateId, ctx.user.id);
  if (error) return { error };

  revalidatePath(ROUTES.dashboardDiet);
  revalidatePath(ROUTES.dashboardExercise);
  return { success: "Template rejected." };
}
