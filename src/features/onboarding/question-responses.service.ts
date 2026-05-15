import type { SupabaseClient } from "@supabase/supabase-js";

import { ONBOARDING_FORMS_IN_ORDER } from "./constants";
import type { AnswersPayload, OnboardingFormName, QuestionsResponseRow } from "./types";

/**
 * Hydrates `questions_responses` for questionnaire sections. Canonical columns live in
 * `012_onboarding_questionnaire.sql` + patch `016_questions_responses_app_columns_alignment.sql`
 * (legacy DBs sometimes used `submitted_at` instead of `created_at`).
 */
type RawResponse = {
  id: string;
  profile_id: string;
  outlet_id: string;
  form_name: string;
  answers_json: unknown;
  answered_by?: string | null;
  last_edited_by?: string | null;
  is_complete?: boolean | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Older drafts — migrated in 016. */
  submitted_at?: string | null;
};

function mapRow(raw: RawResponse): QuestionsResponseRow {
  const fallbackTs =
    raw.created_at ?? raw.updated_at ?? raw.submitted_at ?? new Date().toISOString();
  return {
    id: raw.id,
    profile_id: raw.profile_id,
    outlet_id: raw.outlet_id,
    form_name: raw.form_name as OnboardingFormName,
    answers_json: (typeof raw.answers_json === "object" && raw.answers_json) ? (raw.answers_json as Record<string, unknown>) : {},
    answered_by: raw.answered_by ?? null,
    last_edited_by: raw.last_edited_by ?? null,
    is_complete: raw.is_complete ?? false,
    completed_at: raw.completed_at ?? null,
    created_at: fallbackTs,
    updated_at: raw.updated_at ?? raw.submitted_at ?? fallbackTs,
  };
}

export async function fetchResponsesBundle(
  supabase: SupabaseClient,
  profileId: string,
  outletId: string,
): Promise<Partial<Record<OnboardingFormName, QuestionsResponseRow>>> {
  const { data, error } = await supabase
    .from("questions_responses")
    /** `*` avoids PostgREST errors when a column (e.g. `created_at`) is missing pre-migration — mapRow coerces. */
    .select("*")
    .eq("profile_id", profileId)
    .eq("outlet_id", outletId)
    .in("form_name", ONBOARDING_FORMS_IN_ORDER)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const bundle: Partial<Record<OnboardingFormName, QuestionsResponseRow>> = {};
  for (const row of (data ?? []) as unknown as RawResponse[]) {
    bundle[row.form_name as OnboardingFormName] = mapRow(row);
  }
  return bundle;
}

export async function upsertQuestionsResponse(params: {
  supabase: SupabaseClient;
  profileId: string;
  outletId: string;
  formName: OnboardingFormName;
  answers: AnswersPayload;
  actorProfileId: string | null;
  finalize: boolean;
  previous?: Pick<QuestionsResponseRow, "answered_by" | "is_complete" | "completed_at"> | null;
}) {
  const { supabase, profileId, outletId, formName, answers, actorProfileId, finalize, previous } = params;

  const nowIso = new Date().toISOString();
  const nextComplete = finalize ? true : (previous?.is_complete ?? false);

  const base = {
    profile_id: profileId,
    outlet_id: outletId,
    form_name: formName,
    answers_json: answers,
    last_edited_by: actorProfileId,
    answered_by: previous?.answered_by ?? actorProfileId,
    is_complete: nextComplete,
    completed_at:
      finalize ? nowIso : nextComplete ? (previous?.completed_at ?? nowIso) : null,
  };

  const { error } = await supabase.from("questions_responses").upsert(base, {
    onConflict: "profile_id,outlet_id,form_name",
  });

  if (error) throw new Error(error.message);
}
