import { buildAnswersDefaultValues } from "@/features/onboarding/components/onboarding-defaults";
import { ONBOARDING_FORMS_IN_ORDER } from "@/features/onboarding/constants";
import {
  EMPTY_MEMBER_QUESTION_CONTEXT,
  filterQuestionDefinitions,
  type MemberQuestionContext,
} from "@/features/onboarding/question-visibility";
import type { OnboardingFormName, QuestionDefinition } from "@/features/onboarding/types";

/**
 * Client-side draft for `/dashboard/customers/new` wizard.
 * Questionnaire answers keyed by `form_name` — same shape as `questions_responses.answers_json`.
 *
 * **Draft lifecycle:** only persisted when staff click “Save as draft” (`savedAt` set).
 * `/dashboard/customers/new` always starts blank; resume via Drafts tab → `?resume=1`.
 */
export type QuestionnaireAnswersBundle = Partial<Record<OnboardingFormName, Record<string, unknown>>>;

export type CustomerOnboardDraft = {
  step: number;
  /**
   * Set when staff confirms an existing floating customer on Identity step
   * (`find_existing_customer` + {@link ExistingCustomerLinkDialog}).
   */
  linkExistingProfileId: string | null;
  /** Phone digits/E.164 snapshot when link was confirmed — cleared when phone input changes. */
  lookupConfirmedPhone: string | null;
  identity: {
    fullName: string;
    phone: string;
    email: string;
    dateOfBirth: string;
    gender: "" | "male" | "female" | "other";
  };
  membership: {
    outletId: string;
    planId: string;
    startDate: string;
    logPaymentNow: boolean;
    /** Optional coach — set on Review step; persisted as `gym_memberships.assigned_trainer_id`. */
    assignedTrainerId: string;
  };
  health: {
    heightCm: string;
    weightKg: string;
    /** Legacy — kept for draft migration; no longer shown in UI. */
    conditions?: string[];
    pastInjuries?: string;
    currentMedications?: string;
  };
  questionnaireAnswers: QuestionnaireAnswersBundle;
  /** ISO timestamp — set only when staff clicks “Save as draft” (not auto-saved). */
  savedAt?: string | null;
};

export const WIZARD_STEP_LABELS = [
  "Identity",
  "Membership",
  "Basic Info",
  "Health Screening",
  "Diet Preferences",
  "Review",
] as const;

/** Zero-based index of the review step — keep in sync with {@link WIZARD_STEP_LABELS}. */
export const WIZARD_REVIEW_STEP = WIZARD_STEP_LABELS.length - 1;

/** URL slugs for `/dashboard/customers/[id]?section=` — order matches {@link WIZARD_STEP_LABELS}. */
export const PROFILE_SECTION_SLUGS = [
  "identity",
  "membership",
  "basic-info",
  "health-screening",
  "diet-preferences",
  "review",
] as const;

export type ProfileSectionSlug = (typeof PROFILE_SECTION_SLUGS)[number];

export function profileSectionSlug(step: number): ProfileSectionSlug {
  return PROFILE_SECTION_SLUGS[Math.min(Math.max(0, step), WIZARD_REVIEW_STEP)] ?? PROFILE_SECTION_SLUGS[0];
}

/** Parse `?section=` query — accepts slug or numeric index. */
export function parseProfileSection(raw: string | null | undefined): number {
  if (!raw?.length) return 0;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum >= 0 && asNum <= WIZARD_REVIEW_STEP) return asNum;
  const idx = PROFILE_SECTION_SLUGS.indexOf(raw as ProfileSectionSlug);
  return idx >= 0 ? idx : 0;
}

/** Migrate saved drafts from the old 5-step wizard (Health + combined Questionnaire). */
export function migrateWizardStepIndex(step: number): number {
  if (step <= 2) return step;
  if (step === 3) return 2;
  if (step === 4) return WIZARD_REVIEW_STEP;
  return Math.min(step, WIZARD_REVIEW_STEP);
}

export function draftStorageKey(actorProfileId: string): string {
  return `onex-customer-onboard-draft:${actorProfileId}`;
}

export function emptyDraft(defaultOutletId: string, defaultStartDate: string): CustomerOnboardDraft {
  return {
    step: 0,
    linkExistingProfileId: null,
    lookupConfirmedPhone: null,
    identity: { fullName: "", phone: "", email: "", dateOfBirth: "", gender: "" },
    membership: { outletId: defaultOutletId, planId: "", startDate: defaultStartDate, logPaymentNow: false, assignedTrainerId: "" },
    health: { heightCm: "", weightKg: "" },
    questionnaireAnswers: {},
    savedAt: null,
  };
}

export function loadDraft(key: string): CustomerOnboardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerOnboardDraft;
  } catch {
    return null;
  }
}

/** Maps legacy flat `questionnaire` object from early wizard drafts into `questionnaireAnswers`. */
function migrateLegacyQuestionnaire(raw: Record<string, unknown>): QuestionnaireAnswersBundle {
  const basic: Record<string, unknown> = {};
  const health: Record<string, unknown> = {};
  const diet: Record<string, unknown> = {};

  if (typeof raw.fitnessGoal === "string" && raw.fitnessGoal) basic.fitness_goal = raw.fitnessGoal;
  if (typeof raw.activityLevel === "string" && raw.activityLevel) basic.activity_level = raw.activityLevel;
  if (typeof raw.emergencyContactName === "string") basic.emergency_contact_name = raw.emergencyContactName;
  if (typeof raw.emergencyContactPhone === "string") basic.emergency_contact_phone = raw.emergencyContactPhone;

  if (typeof raw.parqAcknowledged === "boolean") health.parq_acknowledged = raw.parqAcknowledged;
  if (typeof raw.heartCondition === "boolean") health.heart_condition = raw.heartCondition;
  if (typeof raw.chestPainWhenActive === "boolean") health.chest_pain_when_active = raw.chestPainWhenActive;
  if (typeof raw.medicationsNotes === "string") health.medications_notes = raw.medicationsNotes;

  if (Array.isArray(raw.dietPattern)) diet.diet_pattern = raw.dietPattern;
  if (Array.isArray(raw.foodAllergies)) diet.food_allergies = raw.foodAllergies;
  if (typeof raw.hydrationLiters === "string" && raw.hydrationLiters) {
    diet.hydration_liters = Number(raw.hydrationLiters);
  }
  if (typeof raw.sweetToothScale === "string" && raw.sweetToothScale) {
    diet.sweet_tooth_scale = Number(raw.sweetToothScale);
  }

  const out: QuestionnaireAnswersBundle = {};
  if (Object.keys(basic).length) out.basic_info = basic;
  if (Object.keys(health).length) out.health_screening = health;
  if (Object.keys(diet).length) out.diet_preferences = diet;
  return out;
}

/**
 * Merge a saved localStorage draft with defaults — older drafts may use the flat `questionnaire` shape.
 */
export function normalizeDraft(
  partial: CustomerOnboardDraft | (Omit<CustomerOnboardDraft, "questionnaireAnswers"> & { questionnaire?: Record<string, unknown>; questionnaireAnswers?: QuestionnaireAnswersBundle }) | null | undefined,
  defaultOutletId: string,
  defaultStartDate: string,
): CustomerOnboardDraft {
  const base = emptyDraft(defaultOutletId, defaultStartDate);
  if (!partial) return base;

  const legacy = partial as { questionnaire?: Record<string, unknown>; questionnaireAnswers?: QuestionnaireAnswersBundle };
  let questionnaireAnswers = legacy.questionnaireAnswers ?? {};
  if (legacy.questionnaire && typeof legacy.questionnaire === "object") {
    questionnaireAnswers = { ...migrateLegacyQuestionnaire(legacy.questionnaire), ...questionnaireAnswers };
  }

  return {
    step: migrateWizardStepIndex(typeof partial.step === "number" ? partial.step : base.step),
    linkExistingProfileId:
      typeof partial.linkExistingProfileId === "string" ? partial.linkExistingProfileId : base.linkExistingProfileId,
    lookupConfirmedPhone:
      typeof partial.lookupConfirmedPhone === "string" ? partial.lookupConfirmedPhone : base.lookupConfirmedPhone,
    identity: { ...base.identity, ...partial.identity },
    membership: {
      ...base.membership,
      ...partial.membership,
      assignedTrainerId: strField(partial.membership?.assignedTrainerId),
    },
    health: {
      heightCm: strField(partial.health?.heightCm),
      weightKg: strField(partial.health?.weightKg),
    },
    questionnaireAnswers,
    savedAt: typeof partial.savedAt === "string" ? partial.savedAt : base.savedAt ?? null,
  };
}

function strField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function saveDraft(key: string, draft: CustomerOnboardDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    notifyCustomerDraftChanged();
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new Event("onex-customer-draft-changed"));
  } catch {
    /* ignore */
  }
}

/** Notify customers Draft tab after explicit save (same-tab; `storage` event is cross-tab only). */
export function notifyCustomerDraftChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("onex-customer-draft-changed"));
}

/** True when localStorage has a draft worth showing on the Drafts tab. */
export function isMeaningfulDraft(draft: CustomerOnboardDraft | null | undefined): boolean {
  if (!draft) return false;
  if (draft.savedAt) return true;
  if (draft.linkExistingProfileId) return true;
  if (draft.step > 0) return true;
  const id = draft.identity;
  if (id.fullName.trim() || id.phone.trim() || id.email.trim() || id.dateOfBirth || id.gender) return true;
  if (draft.health.heightCm.trim() || draft.health.weightKg.trim()) return true;
  if (Object.keys(draft.questionnaireAnswers).length > 0) return true;
  if (draft.membership.planId || draft.membership.logPaymentNow || draft.membership.assignedTrainerId) return true;
  return false;
}

export type CustomerOnboardDraftSummary = {
  title: string;
  subtitle: string;
  stepLabel: string;
  savedAt: string | null;
  isLinkingExisting: boolean;
};

/** Human-readable card for `/dashboard/customers?tab=drafts`. */
export function summarizeCustomerOnboardDraft(
  draft: CustomerOnboardDraft,
  outletLabel?: string,
): CustomerOnboardDraftSummary {
  const name = draft.identity.fullName.trim();
  const phone = draft.identity.phone.trim();
  const title = name || phone || "Unnamed draft";
  const parts: string[] = [];
  if (phone && name) parts.push(phone);
  if (outletLabel) parts.push(outletLabel);
  if (draft.linkExistingProfileId) parts.push("Linking existing member");
  const stepLabel = WIZARD_STEP_LABELS[draft.step] ?? `Step ${draft.step + 1}`;
  return {
    title,
    subtitle: parts.join(" · ") || "No contact details yet",
    stepLabel,
    savedAt: draft.savedAt ?? null,
    isLinkingExisting: Boolean(draft.linkExistingProfileId),
  };
}

/** Build `questionnaire_payload_json` for `onboardMemberWizardAction` using live DB definitions. */
export function buildQuestionnairePayload(
  definitions: Record<OnboardingFormName, QuestionDefinition[]> | undefined,
  answers: QuestionnaireAnswersBundle,
  memberContext?: MemberQuestionContext,
): Record<string, Record<string, unknown>> {
  const payload: Record<string, Record<string, unknown>> = {};
  if (!definitions) return payload;

  for (const formName of ONBOARDING_FORMS_IN_ORDER) {
    const defs = filterQuestionDefinitions(definitions[formName] ?? [], memberContext ?? EMPTY_MEMBER_QUESTION_CONTEXT);
    if (!defs.length) continue;
    const merged = buildAnswersDefaultValues(defs, answers[formName] ?? {});
    const section: Record<string, unknown> = {};
    for (const d of defs) {
      if (merged[d.question_key] !== undefined) {
        section[d.question_key] = merged[d.question_key];
      }
    }
    if (Object.keys(section).length) {
      payload[formName] = section;
    }
  }
  return payload;
}
