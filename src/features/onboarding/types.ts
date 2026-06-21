import type { UserRole } from "@/lib/auth/roles";
import type { ProfileGender } from "@/lib/profile/vitals";

/**
 * DB enum `question_input_type` — keep aligned with `012_onboarding_questionnaire.sql`.
 */
export type QuestionInputTypeDb = "select" | "multiselect" | "boolean" | "text" | "number" | "scale";

/** `form_name` values — also used for section-level RBAC in `permissions.ts`. */
export type OnboardingFormName = "basic_info" | "health_screening" | "diet_preferences";

export type QuestionOption = { value: string; label: string };

/**
 * Stored in `question_definitions.visibility_json`.
 * Extend with more keys later (e.g. min_age) without breaking existing rows.
 */
export type QuestionVisibilityRules = {
  /** When non-empty, only these profile genders see the prompt. */
  genders?: ProfileGender[];
  /**
   * Show only when another answer in the same section matches.
   * Example: eats_eggs when diet_type = Vegetarian.
   */
  show_when?: {
    question_key: string;
    values: string[];
  };
};

export type QuestionDefinition = {
  id: string;
  outlet_id: string | null;
  form_name: OnboardingFormName;
  question_key: string;
  label: string;
  helper_text: string | null;
  input_type: QuestionInputTypeDb;
  options_json: QuestionOption[] | null;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  editable_by_customer: boolean;
  validation_json: Record<string, unknown> | null;
  /** Parsed from DB `visibility_json` — see {@link parseQuestionVisibility}. */
  visibility_json: QuestionVisibilityRules | null;
};

export type QuestionsResponseRow = {
  id: string;
  profile_id: string;
  outlet_id: string;
  form_name: OnboardingFormName;
  answers_json: Record<string, unknown>;
  answered_by: string | null;
  last_edited_by: string | null;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingViewerContext = {
  role: UserRole;
  profileId: string;
  outletId: string;
  membershipId: string;
  actorProfileId: string;
  /** Member route: gate per-field with `editable_by_customer`. Staff filling intake passes false. */
  isCustomerActor: boolean;
};

export type AnswersPayload = Record<string, unknown>;
