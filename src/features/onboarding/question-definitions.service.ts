import type { SupabaseClient } from "@supabase/supabase-js";

import { mergeOutletQuestionDefinitions } from "./merge-question-definitions";
import { ONBOARDING_FORMS_IN_ORDER } from "./constants";
import type { OnboardingFormName, QuestionDefinition, QuestionInputTypeDb, QuestionOption } from "./types";

/**
 * Mirrors `question_definitions` rows returned by Supabase — includes optional `hint`
 * seen in Dashboard exports (`helper_text` may be null while `hint` holds the subtitle).
 *
 * **`options_json` shapes (both supported):**
 * - App / migration-friendly: `[{"value":"a","label":"A"}, ...]`
 * - Excel-style dumps: `["Option A","Option B"]` — each string becomes value+label.
 */
type RawQuestionRow = {
  id: string;
  outlet_id: string | null;
  form_name: string;
  question_key: string;
  label: string;
  helper_text?: string | null;
  /** Legacy / export column — subtitle under the label. */
  hint?: string | null;
  input_type: string;
  options_json: unknown;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  editable_by_customer: boolean;
  validation_json?: unknown;
};

function normalizeOptions(raw: unknown): QuestionOption[] | null {
  if (!raw) return null;
  if (!Array.isArray(raw)) return null;
  const out: QuestionOption[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const label = item.trim();
      if (!label.length) continue;
      /** Stored answer value matches DB string (stable for selects / multiselect). */
      out.push({ value: label, label });
      continue;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      const value = typeof rec.value === "string" ? rec.value.trim() : null;
      const label = typeof rec.label === "string" ? rec.label.trim() : value;
      if (!value?.length || !label?.length) continue;
      out.push({ value, label });
    }
  }
  return out.length ? out : null;
}

function mapRow(raw: RawQuestionRow): QuestionDefinition {
  const form_name = raw.form_name as OnboardingFormName;
  const helperTrimmed = typeof raw.helper_text === "string" ? raw.helper_text.trim() : "";
  const hintTrimmed = typeof raw.hint === "string" ? raw.hint.trim() : "";
  const helper_text = helperTrimmed.length ? helperTrimmed : hintTrimmed.length ? hintTrimmed : null;
  return {
    id: raw.id,
    outlet_id: raw.outlet_id,
    form_name,
    question_key: raw.question_key,
    label: raw.label,
    helper_text,
    input_type: raw.input_type as QuestionInputTypeDb,
    options_json: normalizeOptions(raw.options_json),
    is_required: raw.is_required,
    is_active: raw.is_active,
    display_order: raw.display_order,
    editable_by_customer: raw.editable_by_customer,
    validation_json:
      raw.validation_json && typeof raw.validation_json === "object"
        ? (raw.validation_json as Record<string, unknown>)
        : null,
  };
}

export async function fetchMergedDefinitionsForOutlet(
  supabase: SupabaseClient,
  outletId: string,
): Promise<Record<OnboardingFormName, QuestionDefinition[]>> {
  const { data, error } = await supabase
    .from("question_definitions")
    /** `*` keeps exports with extra-only columns (`hint`, `visible_to_customer`, ...) from breaking selects. */
    .select("*")
    .in("form_name", ONBOARDING_FORMS_IN_ORDER)
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`outlet_id.is.null,outlet_id.eq.${outletId}`)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);

  const mapped = ((data ?? []) as unknown as RawQuestionRow[]).map(mapRow);
  const grouped: Partial<Record<OnboardingFormName, QuestionDefinition[]>> = {};

  for (const form of ONBOARDING_FORMS_IN_ORDER) {
    const slice = mapped.filter((row) => row.form_name === form);
    grouped[form] = mergeOutletQuestionDefinitions(slice);
  }

  return grouped as Record<OnboardingFormName, QuestionDefinition[]>;
}
