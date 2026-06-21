import type { SupabaseClient } from "@supabase/supabase-js";

import { callLlmJsonCompletion, parseAiPlanJson } from "./llm";
import { insertAiGeneratedTemplate } from "./insert-ai-template";
import { mapDietTypeTag } from "./diet-tags";
import {
  northIndiaDietSystemRules,
  northIndiaMealSchemaExample,
} from "./regional-diet-context";
import {
  buildSafeGenericTemplate,
  fetchGroundingTemplates,
  summarizeTemplateForPrompt,
} from "./safe-defaults";
import type { GetPlanResult, PlanTemplateType, UserProfile } from "./types";

const AI_SCHEMA_EXAMPLE = {
  name: "string — plan title",
  description: "string | null",
  duration_weeks: "number >= 1",
  weeks: [
    {
      week_number: 1,
      title: "string | null",
      overview: "string | null",
      days: [
        {
          day_number: 1,
          day_label: "string | null",
          is_rest_day: false,
          overview: "string | null",
          targets: {
            target_calories: 2000,
            target_protein_g: 120,
            target_carbs_g: 200,
            target_fat_g: 60,
            target_water_ml: 2500,
            target_steps: 8000,
          },
          meals: [northIndiaMealSchemaExample()],
          exercises: [
            {
              exercise_name: "Squat",
              muscle_group: "legs",
              equipment: "bodyweight",
              category: "strength",
              sets: 3,
              reps: "12",
              duration_seconds: null,
              rest_seconds: 60,
              instructions: "string",
              tips: "string | null",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Groq fallback when hard-filter matching finds no verified template.
 * Writes validated output into `plan_templates` (same table as manual templates).
 */
export async function generateAIFallbackPlan(
  supabase: SupabaseClient,
  userProfile: UserProfile,
  templateType: PlanTemplateType,
): Promise<GetPlanResult> {
  const grounding = await fetchGroundingTemplates(supabase, userProfile, templateType);
  const groundingSummary = grounding.map(summarizeTemplateForPrompt);

  const systemPrompt = [
    "You are a certified fitness/nutrition plan designer for a gym app in India.",
    northIndiaDietSystemRules(),
    "Respond with ONLY valid JSON matching the schema — no markdown, no prose.",
    "Use grounding templates as style/structure reference; do not copy verbatim.",
    "Adapt for member injuries and allergies — substitute or omit conflicting items.",
    "Do not make medical claims. Keep plans practical and safe.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: `Generate a ${templateType} plan`,
      member: {
        goal: userProfile.goal,
        level: userProfile.level,
        gender: userProfile.gender,
        injuries: userProfile.injuries,
        allergies: userProfile.allergies,
        dietPreference: userProfile.dietPreference,
        equipment: userProfile.equipment,
      },
      schema: AI_SCHEMA_EXAMPLE,
      grounding_templates: groundingSummary,
      rules: [
        templateType === "diet"
          ? "Include meals array on each day; omit exercises."
          : "Include exercises array on each day; omit meals.",
        templateType === "diet"
          ? "Meals must use North Indian staples only (roti, dal, paneer, chicken curry, poha, dahi, etc.)."
          : null,
        templateType === "diet"
          ? `Diet MUST match member preference exactly: ${mapDietTypeTag(userProfile.dietPreference ?? null) ?? "balanced"}.`
          : null,
        "2 weeks, 7 days per week (compact plan).",
        "Mark rest days with is_rest_day: true and empty meal/exercise arrays.",
      ].filter(Boolean),
    },
    null,
    2,
  );

  let payload;
  try {
    const raw = await callLlmJsonCompletion({ systemPrompt, userPrompt, temperature: 0.4 });
    payload = parseAiPlanJson(raw);
  } catch {
    try {
      const raw = await callLlmJsonCompletion({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        retryHint:
          "Previous response was invalid. Return ONLY JSON with name, duration_weeks, and weeks[].days[] required fields.",
      });
      payload = parseAiPlanJson(raw);
    } catch {
      const safe = buildSafeGenericTemplate(userProfile, templateType);
      return {
        template: safe,
        servedTemplate: safe,
        matchMethod: "safe_fallback",
        pendingReview: true,
      };
    }
  }

  const inserted = await insertAiGeneratedTemplate(supabase, userProfile, templateType, payload);

  // Assign the real AI row to the member — pending_review flags it for staff either way.
  return {
    template: inserted,
    servedTemplate: inserted,
    matchMethod: "ai_generated",
    pendingReview: true,
  };
}
