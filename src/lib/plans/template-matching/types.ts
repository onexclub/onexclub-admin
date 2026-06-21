/**
 * Member profile slice used by the template matching engine.
 *
 * **Reuse:** Built from intake via {@link buildUserProfileFromIntake}; consumed by
 * {@link getPlanForUser} and Groq fallback.
 *
 * Hard-filter fields (never soft-scored): goal, level, gender, diet preference, injuries/allergies.
 * Soft-score fields (tiebreaker only): equipment, intakeScore, age, bmi (diet already exact-matched).
 */
export type PlanTemplateType = "diet" | "exercise";

export type UserProfile = {
  profileId: string;
  outletId: string;
  /** Normalized slug — maps to `plan_templates.primary_goal` */
  goal: string;
  /** beginner | intermediate | advanced — maps to `plan_templates.difficulty_level` */
  level: string;
  /** male | female — templates with NULL target_gender match any gender */
  gender: string;
  /** Injury/limitation tags from health screening — hard filter via constraint intersection */
  injuries: string[];
  /** Food allergy tags — hard filter for diet; triggers safe fallback when AI generates */
  allergies: string[];
  /** Hard filter for diet plans — normalized slug from diet_type intake (e.g. non_vegetarian) */
  dietPreference?: string | null;
  /** Available equipment slugs — soft score for exercise plans */
  equipment?: string[];
  intakeScore?: number;
  age?: number;
  bmi?: number;
};

/** Row shape from `plan_templates` used in matching. */
export type PlanTemplateRow = {
  id: string;
  outlet_id: string | null;
  plan_type: PlanTemplateType;
  name: string;
  description: string | null;
  difficulty_level: string;
  duration_weeks: number;
  primary_goal: string | null;
  target_gender: string | null;
  min_age: number | null;
  max_age: number | null;
  min_bmi: number | null;
  max_bmi: number | null;
  min_score: number;
  max_score: number;
  tags: string[] | null;
  constraints: string[] | null;
  source: string;
  status: string;
  match_count: number;
  is_active: boolean;
};

export type MatchDiagnostics = {
  memberGoal: string;
  memberLevel: string;
  memberGender: string;
  memberDiet?: string;
  totalAfterGoalLevelGender: number;
  totalAfterDietFilter: number;
  dietTypesInCatalog: Record<string, number>;
  failureCategory:
    | "insufficient_catalog"
    | "diet_mismatch"
    | "validation_rejected"
    | "none";
  message: string;
};

export type MatchValidationResult = {
  approved: boolean;
  confidence: number;
  reason: string;
  failureCategory:
    | "diet_mismatch"
    | "goal_mismatch"
    | "level_mismatch"
    | "gender_mismatch"
    | "insufficient_catalog"
    | "none"
    | "other";
  reviewedBy: "groq" | "openai" | "together" | "custom" | "deterministic" | "llm";
};

export type GetPlanResult = {
  template: PlanTemplateRow;
  /** When diet + allergies/injuries, user sees safe default while AI row awaits review */
  servedTemplate: PlanTemplateRow;
  matchMethod: "hard_filter" | "ai_generated" | "safe_fallback";
  pendingReview: boolean;
  diagnostics?: MatchDiagnostics;
  validation?: MatchValidationResult;
};

export type GetPlanForUserResponse =
  | { success: true; plan: GetPlanResult }
  | {
      success: false;
      diagnostics: MatchDiagnostics;
      validation?: MatchValidationResult;
      rejectedTemplate?: PlanTemplateRow;
    };

/** JSON shape Groq must return — mirrors nested plan structure for insert. */
export type AiGeneratedPlanPayload = {
  name: string;
  description?: string | null;
  duration_weeks: number;
  weeks: Array<{
    week_number: number;
    title?: string | null;
    overview?: string | null;
    days: Array<{
      day_number: number;
      day_label?: string | null;
      is_rest_day?: boolean;
      overview?: string | null;
      targets?: {
        target_calories?: number | null;
        target_protein_g?: number | null;
        target_carbs_g?: number | null;
        target_fat_g?: number | null;
        target_water_ml?: number | null;
        target_steps?: number | null;
      } | null;
      meals?: Array<{
        meal_name: string;
        meal_time?: string | null;
        meal_type?: string | null;
        foods?: unknown;
        calories?: number | null;
        protein_g?: number | null;
        carbs_g?: number | null;
        fat_g?: number | null;
        preparation_note?: string | null;
      }>;
      exercises?: Array<{
        exercise_name: string;
        muscle_group?: string | null;
        equipment?: string | null;
        category?: string | null;
        sets?: number | null;
        reps?: string | null;
        duration_seconds?: number | null;
        rest_seconds?: number | null;
        instructions?: string | null;
        tips?: string | null;
      }>;
    }>;
  }>;
};

export type PendingReviewTemplate = PlanTemplateRow & {
  plan_type: PlanTemplateType;
  created_by_ai_at: string | null;
};
