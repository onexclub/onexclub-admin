import type { SupabaseClient } from "@supabase/supabase-js";

import { buildUserProfileFromIntake } from "./build-user-profile";
import { getPlanForUser } from "./get-plan-for-user";
import type { MatchDiagnostics, PlanTemplateType } from "./types";

export type AssignPlanFailure = {
  planType: PlanTemplateType;
  diagnostics: MatchDiagnostics;
  rejectedTemplateName?: string;
  validationReason?: string;
};

export type AssignWithMatchingResult = {
  exercise?: { assignmentId: string; planName: string; matchMethod: string };
  diet?: { assignmentId: string; planName: string; matchMethod: string };
  error?: string;
  /** Per-plan failure analysis when Groq or catalog blocks assignment */
  failures?: AssignPlanFailure[];
  warnings?: string[];
};

/**
 * Assign exercise + diet using hard-filter matching + Groq validation.
 * Blocks assignment when match is wrong — returns diagnostics instead of silent mis-assign.
 */
export async function assignPlansWithMatching(
  supabase: SupabaseClient,
  profileId: string,
  outletId: string,
  options: {
    reason?: string;
    triggeredBy?: string | null;
    existingTier?: { exercise?: string; diet?: string };
    validateWithGroq?: boolean;
  } = {},
): Promise<AssignWithMatchingResult> {
  const userProfile = await buildUserProfileFromIntake(supabase, profileId, outletId);
  if (!userProfile) {
    return { error: "Could not build member profile from intake." };
  }

  const reason = options.reason ?? "initial";
  const result: AssignWithMatchingResult = { failures: [], warnings: [] };

  for (const planType of ["exercise", "diet"] as PlanTemplateType[]) {
    const outcome = await getPlanForUser(supabase, userProfile, planType, {
      validateWithGroq: options.validateWithGroq,
    });

    if (!outcome.success) {
      result.failures!.push({
        planType,
        diagnostics: outcome.diagnostics,
        rejectedTemplateName: outcome.rejectedTemplate?.name,
        validationReason: outcome.validation?.reason,
      });
      continue;
    }

    const planResult = outcome.plan;
    // Always assign the real DB row (catalogue match or AI-inserted template).
    const template = planResult.template;

    if (template.id.startsWith("00000000-0000-0000-0000")) {
      result.failures!.push({
        planType,
        diagnostics:
          planResult.diagnostics ?? {
            memberGoal: userProfile.goal,
            memberLevel: userProfile.level,
            memberGender: userProfile.gender,
            totalAfterGoalLevelGender: 0,
            totalAfterDietFilter: 0,
            dietTypesInCatalog: {},
            failureCategory: "insufficient_catalog",
            message: "AI plan generation failed.",
          },
      });
      continue;
    }

    if (planResult.matchMethod === "ai_generated") {
      result.warnings!.push(
        `${planType}: Personalized AI plan assigned — "${template.name}" (pending trainer review).`,
      );
    }

    const tier = options.existingTier?.[planType] ?? userProfile.level;

    const { data: existing } = await supabase
      .from("customer_plan_assignments")
      .select("id")
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .eq("plan_type", planType)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("customer_plan_assignments")
        .update({
          status: reason === "rotation" ? "completed" : "cancelled",
          deleted_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }

    const { data: seqRow } = await supabase
      .from("customer_plan_assignments")
      .select("plan_sequence")
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .eq("plan_type", planType)
      .order("plan_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planSequence = (seqRow?.plan_sequence ?? 0) + 1;

    const matchMethodDb =
      planResult.matchMethod === "ai_generated"
        ? "ai"
        : options.triggeredBy
          ? "manual"
          : "auto";

    const { data: assignment, error: assignErr } = await supabase
      .from("customer_plan_assignments")
      .insert({
        profile_id: profileId,
        outlet_id: outletId,
        plan_template_id: template.id,
        plan_type: planType,
        matched_score: userProfile.intakeScore ?? null,
        match_method: matchMethodDb,
        start_date: new Date().toISOString().slice(0, 10),
        status: "active",
        plan_sequence: planSequence,
        progression_tier: tier,
        rotation_reason: reason,
        previous_assignment_id: existing?.id ?? null,
        assigned_by: options.triggeredBy ?? null,
      })
      .select("id")
      .single();

    if (assignErr || !assignment) {
      return { error: assignErr?.message ?? `Failed to assign ${planType} plan` };
    }

    const entry = {
      assignmentId: assignment.id,
      planName: template.name,
      matchMethod: planResult.matchMethod,
    };

    if (planType === "exercise") result.exercise = entry;
    else result.diet = entry;
  }

  if (result.failures!.length > 0 && !result.exercise && !result.diet) {
    return {
      error: formatAssignFailures(result.failures!),
      failures: result.failures,
    };
  }

  if (result.failures!.length > 0) {
    result.warnings!.push(formatAssignFailures(result.failures!));
  }

  if (result.failures!.length === 0) delete result.failures;
  if (result.warnings!.length === 0) delete result.warnings;

  return result;
}

function formatAssignFailures(failures: AssignPlanFailure[]): string {
  return failures
    .map((f) => {
      const parts = [`${f.planType.toUpperCase()}: ${f.diagnostics.message}`];
      if (f.rejectedTemplateName) parts.push(`Rejected plan: "${f.rejectedTemplateName}"`);
      if (f.validationReason) parts.push(`Review: ${f.validationReason}`);
      return parts.join(" · ");
    })
    .join("\n");
}
