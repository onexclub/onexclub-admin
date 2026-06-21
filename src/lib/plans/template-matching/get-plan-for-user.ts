import type { SupabaseClient } from "@supabase/supabase-js";

import { filterByDietPreference } from "./diet-compatibility";
import { filterByVegetarianEggPreference } from "./diet-meal-validation";
import { resolveMemberDietFromProfile } from "./resolve-diet-preference";
import { generateAIFallbackPlan } from "./generate-ai-fallback";
import { filterByConstraints } from "./hard-filter";
import { logTemplateGap } from "./log-template-gap";
import { buildMatchDiagnostics } from "./match-diagnostics";
import { rankCandidatesBySoftScore } from "./soft-score";
import type {
  GetPlanForUserResponse,
  GetPlanResult,
  MatchDiagnostics,
  PlanTemplateRow,
  PlanTemplateType,
  UserProfile,
} from "./types";
import { isLlmConfigured } from "./llm/config";
import { validateMatchWithGroq } from "./validate-match-groq";

const TEMPLATE_SELECT = [
  "id",
  "outlet_id",
  "plan_type",
  "name",
  "description",
  "difficulty_level",
  "duration_weeks",
  "primary_goal",
  "target_gender",
  "min_age",
  "max_age",
  "min_bmi",
  "max_bmi",
  "min_score",
  "max_score",
  "tags",
  "constraints",
  "source",
  "status",
  "match_count",
  "is_active",
].join(",");

export type GetPlanOptions = {
  validateWithGroq?: boolean;
  maxValidationAttempts?: number;
};

/**
 * Flow: DB hard-filter match → Groq validates → if no match, Groq generates personalized plan.
 */
export async function getPlanForUser(
  supabase: SupabaseClient,
  userProfile: UserProfile,
  templateType: PlanTemplateType,
  options: GetPlanOptions = {},
): Promise<GetPlanForUserResponse> {
  const validateWithGroq = options.validateWithGroq ?? isLlmConfigured();
  const maxAttempts = options.maxValidationAttempts ?? 3;

  const goalSlugs = userProfile.goalFallbacks?.length
    ? userProfile.goalFallbacks
    : [userProfile.goal];

  const { data, error } = await supabase
    .from("plan_templates")
    .select(TEMPLATE_SELECT)
    .eq("plan_type", templateType)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("primary_goal", goalSlugs)
    .eq("difficulty_level", userProfile.level)
    .or(`outlet_id.eq.${userProfile.outletId},outlet_id.is.null`);

  if (error) throw new Error(error.message);

  const demographicPool = filterByConstraints(
    ((data ?? []) as unknown as PlanTemplateRow[]).filter((row) => {
      if (!userProfile.gender || userProfile.gender === "any") return true;
      return row.target_gender == null || row.target_gender === userProfile.gender;
    }),
    userProfile,
  );

  const resolvedDiet = resolveMemberDietFromProfile(userProfile);
  const matchingPoolRaw =
    templateType === "diet"
      ? filterByDietPreference(demographicPool, userProfile)
      : demographicPool;

  const matchingPool =
    templateType === "diet" && resolvedDiet.baseDiet === "vegetarian"
      ? await filterByVegetarianEggPreference(
          supabase,
          matchingPoolRaw,
          resolvedDiet.eatsEggs,
        )
      : matchingPoolRaw;

  // ── No DB match → Groq creates a personalized plan and saves to plan_templates ──
  if (matchingPool.length === 0) {
    const diagnostics = buildMatchDiagnostics({
      userProfile,
      templateType,
      afterDemographicFilter: demographicPool,
      afterDietFilter: matchingPool,
      failureCategory: "insufficient_catalog",
    });
    return tryAiPersonalizedPlan(supabase, userProfile, templateType, diagnostics);
  }

  const ranked = rankCandidatesBySoftScore(matchingPool, userProfile, maxAttempts);

  for (const candidate of ranked) {
    let validation = null;
    if (validateWithGroq) {
      validation = await validateMatchWithGroq(userProfile, candidate, templateType);
      if (validation && !validation.approved) {
        if (ranked.indexOf(candidate) < ranked.length - 1) continue;

        const rejectDiagnostics = buildMatchDiagnostics({
          userProfile,
          templateType,
          afterDemographicFilter: demographicPool,
          afterDietFilter: matchingPool,
          failureCategory: "validation_rejected",
          extraMessage:
            `Match rejected for "${candidate.name}": ${validation.reason}. ` +
            `Falling back to AI personalized plan.`,
        });

        const aiOutcome = await tryAiPersonalizedPlan(
          supabase,
          userProfile,
          templateType,
          rejectDiagnostics,
        );
        if (aiOutcome.success) return aiOutcome;

        return {
          success: false,
          diagnostics: rejectDiagnostics,
          validation,
          rejectedTemplate: candidate,
        };
      }
    }

    await supabase
      .from("plan_templates")
      .update({ match_count: (candidate.match_count ?? 0) + 1 })
      .eq("id", candidate.id);

    const plan: GetPlanResult = {
      template: { ...candidate, match_count: (candidate.match_count ?? 0) + 1 },
      servedTemplate: { ...candidate, match_count: (candidate.match_count ?? 0) + 1 },
      matchMethod: "hard_filter",
      pendingReview: false,
      validation: validation ?? undefined,
    };

    return { success: true, plan };
  }

  const fallbackDiagnostics = buildMatchDiagnostics({
    userProfile,
    templateType,
    afterDemographicFilter: demographicPool,
    afterDietFilter: matchingPool,
    failureCategory: "validation_rejected",
  });

  return tryAiPersonalizedPlan(supabase, userProfile, templateType, fallbackDiagnostics);
}

/** Catalog gap → Groq generates plan, inserts into DB, returns for assignment. */
async function tryAiPersonalizedPlan(
  supabase: SupabaseClient,
  userProfile: UserProfile,
  templateType: PlanTemplateType,
  diagnostics: MatchDiagnostics,
): Promise<GetPlanForUserResponse> {
  await logTemplateGap(supabase, userProfile, templateType);

  if (!isLlmConfigured()) {
    return {
      success: false,
      diagnostics: {
        ...diagnostics,
        message: `${diagnostics.message} Set PLAN_LLM_API_KEY (or GROQ_API_KEY) in .env.local to auto-generate a personalized plan.`,
      },
    };
  }

  try {
    const aiPlan = await generateAIFallbackPlan(supabase, userProfile, templateType);

    if (aiPlan.matchMethod === "safe_fallback") {
      return {
        success: false,
        diagnostics: {
          ...diagnostics,
          message: `${diagnostics.message} AI generation failed — could not build a personalized plan.`,
        },
      };
    }

    return {
      success: true,
      plan: {
        ...aiPlan,
        diagnostics: {
          ...diagnostics,
          message: `No catalogue match — created personalized AI ${templateType} plan "${aiPlan.template.name}".`,
        },
      },
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      diagnostics: {
        ...diagnostics,
        message: `${diagnostics.message} AI generation error: ${detail}`,
      },
    };
  }
}
