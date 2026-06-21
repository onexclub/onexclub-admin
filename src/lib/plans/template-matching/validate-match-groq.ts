import { callLlmJsonCompletion } from "./llm";
import { getLlmConfig, isLlmConfigured } from "./llm/config";
import { inferTemplateDietType, formatDietLabel } from "./diet-compatibility";
import { resolveMemberDietFromProfile } from "./resolve-diet-preference";
import type { MatchValidationResult, PlanTemplateRow, PlanTemplateType, UserProfile } from "./types";

type GroqValidationPayload = {
  approved: boolean;
  confidence: number;
  reason: string;
  failure_category:
    | "diet_mismatch"
    | "goal_mismatch"
    | "level_mismatch"
    | "gender_mismatch"
    | "insufficient_catalog"
    | "none"
    | "other";
};

/**
 * Ask Groq to sanity-check a proposed template before assignment.
 * Skipped when GROQ_API_KEY is missing — deterministic hard filters still apply.
 */
export async function validateMatchWithGroq(
  userProfile: UserProfile,
  template: PlanTemplateRow,
  templateType: PlanTemplateType,
): Promise<MatchValidationResult | null> {
  if (!isLlmConfigured()) return null;

  const resolved = resolveMemberDietFromProfile(userProfile);
  const templateDiet = inferTemplateDietType(template);

  const systemPrompt = [
    "You are a gym plan matching QA reviewer.",
    "Respond with ONLY valid JSON.",
    "Reject clearly wrong matches (e.g. Vegan plan for Non-Vegetarian member).",
    "Approve when goal, level, gender, and diet type align with member intake.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Review whether this template is appropriate for this member before assignment",
      member: {
        goal: userProfile.goal,
        level: userProfile.level,
        gender: userProfile.gender,
        diet: resolved.displayLabel,
        eats_eggs: resolved.eatsEggs,
        special_diet: resolved.specialDiet,
        allergies: userProfile.allergies,
        injuries: userProfile.injuries,
      },
      proposed_template: {
        plan_type: templateType,
        name: template.name,
        primary_goal: template.primary_goal,
        difficulty_level: template.difficulty_level,
        target_gender: template.target_gender,
        inferred_diet_type: templateDiet,
        tags: template.tags,
      },
      response_schema: {
        approved: "boolean",
        confidence: "0-100",
        reason: "one sentence",
        failure_category:
          "diet_mismatch|goal_mismatch|level_mismatch|gender_mismatch|insufficient_catalog|none|other",
      },
      rules: [
        "Non-Vegetarian member must NOT get Vegan or Vegetarian-only diet plans",
        "Vegetarian who eats eggs must get plans with anda/eggs — NOT strict veg without eggs",
        "Vegetarian who does NOT eat eggs must NOT get eggetarian or egg-heavy plans",
        "Vegan member must NOT get any animal-product diet plans",
        "Goal and difficulty_level must match member profile",
      ],
    },
    null,
    2,
  );

  try {
    const raw = await callLlmJsonCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });
    const parsed = JSON.parse(raw) as GroqValidationPayload;

    return {
      approved: Boolean(parsed.approved),
      confidence: Number(parsed.confidence) || 0,
      reason: parsed.reason ?? "No reason provided",
      failureCategory: parsed.failure_category ?? "other",
      reviewedBy: (getLlmConfig()?.provider ?? "llm") as MatchValidationResult["reviewedBy"],
    };
  } catch {
    // Deterministic fallback when Groq unavailable — strict diet check
    const dietOk =
      templateType !== "diet" ||
      resolved.baseDiet === "no_restrictions" ||
      (resolved.baseDiet === "vegan" && templateDiet === "vegan") ||
      (resolved.baseDiet === "non_vegetarian" && templateDiet === "non_vegetarian") ||
      (resolved.baseDiet === "vegetarian" &&
        templateDiet !== "vegan" &&
        templateDiet !== "non_vegetarian" &&
        (!resolved.eatsEggs ? templateDiet !== "eggetarian" : true));

    return {
      approved: dietOk,
      confidence: dietOk ? 70 : 0,
      reason: dietOk
        ? "Groq unavailable; passed deterministic diet compatibility check."
        : `Groq unavailable; diet mismatch: member wants ${resolved.displayLabel}, template is ${formatDietLabel(templateDiet)}.`,
      failureCategory: dietOk ? "none" : "diet_mismatch",
      reviewedBy: "deterministic",
    };
  }
}
