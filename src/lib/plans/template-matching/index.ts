/**
 * Template matching engine — hard filter + soft score + Groq AI fallback.
 *
 * **Schema note:** This project uses unified `plan_templates` (plan_type diet|exercise),
 * not separate diet_templates / exercise_templates tables. Column mapping:
 *   goal → primary_goal, level → difficulty_level, gender → target_gender
 *
 * **Stack:** Next.js server — configure LLM via PLAN_LLM_* env (Groq default; vendor-swappable).
 */

export type {
  AiGeneratedPlanPayload,
  GetPlanResult,
  GetPlanForUserResponse,
  MatchDiagnostics,
  MatchValidationResult,
  PendingReviewTemplate,
  PlanTemplateRow,
  PlanTemplateType,
  UserProfile,
} from "./types";

export { buildUserProfileFromIntake, mapExperienceToLevel } from "./build-user-profile";
export { filterByConstraints, requiresDietSafetyHold } from "./hard-filter";
export {
  filterByDietPreference,
  inferTemplateDietType,
} from "./diet-compatibility";
export { catalogueGoalSlug, intakeFitnessGoalFallbacks, normalizeFitnessGoalInput } from "./goal-slugs";
export { resolveMemberDiet, resolveMemberDietFromProfile } from "./resolve-diet-preference";
export { isSpecificDietPreference, mapDietTypeTag } from "./diet-tags";
export { scoreTemplateSoft, pickBestBySoftScore, rankCandidatesBySoftScore } from "./soft-score";
export { getPlanForUser } from "./get-plan-for-user";
export type { GetPlanOptions } from "./get-plan-for-user";
export { logTemplateGap } from "./log-template-gap";
export { generateAIFallbackPlan } from "./generate-ai-fallback";
export { validateMatchWithGroq } from "./validate-match-groq";
export { buildMatchDiagnostics } from "./match-diagnostics";
export {
  fetchPendingReviewTemplates,
  approveTemplate,
  rejectTemplate,
} from "./admin-review";
export { assignPlansWithMatching } from "./assign-with-matching";
export type { AssignWithMatchingResult, AssignPlanFailure } from "./assign-with-matching";
export {
  callLlmJsonCompletion,
  getLlmConfig,
  isLlmConfigured,
  parseAiPlanJson,
} from "./llm";
export {
  NORTH_INDIA_REGION,
  northIndiaDietSystemRules,
  northIndiaMealSchemaExample,
} from "./regional-diet-context";
