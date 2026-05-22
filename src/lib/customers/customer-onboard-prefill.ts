/**
 * Prefill add-customer wizard when linking a floating profile.
 *
 * **Reuse:** `loadExistingCustomerPrefillAction` → `CustomerOnboardWizard` after
 * "Continue with this profile". Questionnaire answers come from the member's most recent
 * response per form (any prior outlet) — staff can edit before save.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ONBOARDING_FORMS_IN_ORDER } from "@/features/onboarding/constants";
import type { OnboardingFormName } from "@/features/onboarding/types";
import { formatPhoneLocalDigits } from "@/lib/auth/phone-e164";
import type { ExistingCustomerMatch } from "@/lib/customers/customer-lookup";
import type { CustomerOnboardDraft, QuestionnaireAnswersBundle } from "@/lib/customers/customer-onboard-draft";
import type { ProfileGender } from "@/lib/profile/vitals";
import { PROFILE_CONTACT_AND_VITALS_SELECT } from "@/lib/profile/vitals";

export type ExistingCustomerPrefill = {
  profile: ExistingCustomerMatch;
  questionnaireAnswers: QuestionnaireAnswersBundle;
};

function mapGenderToDraft(gender: ProfileGender | null | undefined): CustomerOnboardDraft["identity"]["gender"] {
  if (gender === "male" || gender === "female" || gender === "other") return gender;
  if (gender === "prefer_not_to_say") return "other";
  return "";
}

function questionnaireResponseSortKey(row: {
  updated_at?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
}): number {
  const ts = row.updated_at ?? row.created_at ?? row.submitted_at;
  if (!ts) return 0;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Latest `answers_json` per form across all outlets for this profile. */
export async function fetchLatestQuestionnaireBundleForProfile(
  service: SupabaseClient,
  profileId: string,
): Promise<QuestionnaireAnswersBundle> {
  // `select("*")` — legacy DBs may have `submitted_at` only (see `016_questions_responses_app_columns_alignment.sql`).
  const { data, error } = await service
    .from("questions_responses")
    .select("*")
    .eq("profile_id", profileId)
    .in("form_name", ONBOARDING_FORMS_IN_ORDER);

  if (error) throw new Error(error.message);

  const rows = [...(data ?? [])]
    .filter((row) => row.deleted_at == null)
    .sort((a, b) => questionnaireResponseSortKey(b) - questionnaireResponseSortKey(a));

  const bundle: QuestionnaireAnswersBundle = {};
  for (const row of rows) {
    const formName = row.form_name as OnboardingFormName;
    if (bundle[formName] != null) continue;
    if (row.answers_json && typeof row.answers_json === "object" && !Array.isArray(row.answers_json)) {
      bundle[formName] = row.answers_json as Record<string, unknown>;
    }
  }
  return bundle;
}

/** Load profile vitals + portable questionnaire history for wizard prefill. */
export async function loadExistingCustomerPrefill(
  service: SupabaseClient,
  profileId: string,
  gymHistory: ExistingCustomerMatch["gym_history"],
): Promise<ExistingCustomerPrefill> {
  const { data: profileRow, error: profileErr } = await service
    .from("profiles")
    .select(`${PROFILE_CONTACT_AND_VITALS_SELECT}, created_at`)
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profileRow) throw new Error("Profile not found.");

  let questionnaireAnswers: QuestionnaireAnswersBundle = {};
  try {
    questionnaireAnswers = await fetchLatestQuestionnaireBundleForProfile(service, profileId);
  } catch (err) {
    // Profile prefill must succeed even when legacy `questions_responses` columns differ.
    console.error("[onboard-prefill] questionnaire load failed:", err);
  }

  const profile: ExistingCustomerMatch = {
    found: true,
    profile_id: profileId,
    full_name: profileRow.full_name,
    phone: profileRow.phone,
    email: profileRow.email,
    bmi: profileRow.bmi != null ? Number(profileRow.bmi) : null,
    gender: (profileRow.gender as ProfileGender | null) ?? null,
    date_of_birth: profileRow.date_of_birth,
    height_cm: profileRow.height_cm != null ? Number(profileRow.height_cm) : null,
    weight_kg: profileRow.weight_kg != null ? Number(profileRow.weight_kg) : null,
    member_since: typeof profileRow.created_at === "string" ? profileRow.created_at : null,
    gym_history: gymHistory,
  };

  return { profile, questionnaireAnswers };
}

/** Merge server prefill into wizard draft — keeps branch/plan choices from the current session. */
export function applyExistingCustomerPrefillToDraft(
  prev: CustomerOnboardDraft,
  prefill: ExistingCustomerPrefill,
  confirmedPhoneE164: string,
): CustomerOnboardDraft {
  const { profile, questionnaireAnswers } = prefill;

  return {
    ...prev,
    linkExistingProfileId: profile.profile_id,
    lookupConfirmedPhone: confirmedPhoneE164,
    step: 0,
    identity: {
      ...prev.identity,
      fullName: profile.full_name?.trim() || prev.identity.fullName,
      phone: profile.phone ? formatPhoneLocalDigits(profile.phone) : prev.identity.phone,
      email: profile.email?.trim() || prev.identity.email,
      dateOfBirth: profile.date_of_birth ?? prev.identity.dateOfBirth,
      gender: mapGenderToDraft(profile.gender) || prev.identity.gender,
    },
    health: {
      ...prev.health,
      heightCm: profile.height_cm != null ? String(profile.height_cm) : prev.health.heightCm,
      weightKg: profile.weight_kg != null ? String(profile.weight_kg) : prev.health.weightKg,
    },
    questionnaireAnswers: { ...questionnaireAnswers },
  };
}
