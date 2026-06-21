import type { SupabaseClient } from "@supabase/supabase-js";

import type { PendingReviewTemplate, PlanTemplateType } from "./types";

const REVIEW_SELECT =
  "id,outlet_id,plan_type,name,description,difficulty_level,duration_weeks,primary_goal,target_gender,tags,constraints,source,status,match_count,created_by_ai_at,is_active";

/** All AI-generated templates awaiting staff approval, highest traffic first. */
export async function fetchPendingReviewTemplates(
  supabase: SupabaseClient,
  planType?: PlanTemplateType,
): Promise<{ rows: PendingReviewTemplate[]; error: string | null }> {
  let query = supabase
    .from("plan_templates")
    .select(REVIEW_SELECT)
    .eq("status", "pending_review")
    .eq("source", "ai_generated")
    .is("deleted_at", null)
    .order("match_count", { ascending: false })
    .order("created_by_ai_at", { ascending: true });

  if (planType) {
    query = query.eq("plan_type", planType);
  }

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as unknown as PendingReviewTemplate[], error: null };
}

/** Approve AI template — becomes a normal active catalogue row for hard-filter reuse. */
export async function approveTemplate(
  supabase: SupabaseClient,
  templateId: string,
  staffId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("plan_templates")
    .update({
      status: "active",
      reviewed_by: staffId,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("status", "pending_review");

  return { error: error?.message ?? null };
}

/** Reject AI template — hidden from matching pool. */
export async function rejectTemplate(
  supabase: SupabaseClient,
  templateId: string,
  staffId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("plan_templates")
    .update({
      status: "rejected",
      reviewed_by: staffId,
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("status", "pending_review");

  return { error: error?.message ?? null };
}
