import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserProfile } from "./types";
import { mapDietTypeTag } from "./diet-tags";
import { sanitizeMemberTags } from "./member-tags";

const EXPERIENCE_TO_LEVEL: Record<string, string> = {
  "complete beginner": "beginner",
  "less than 6 months": "beginner",
  beginner: "beginner",
  "6 months - 1 year": "intermediate",
  "1-3 years": "intermediate",
  intermediate: "intermediate",
  "3+ years": "advanced",
  advanced: "advanced",
};

/** Map intake `experience_level` label/slug → difficulty tier. */
export function mapExperienceToLevel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "beginner";
  const key = raw.trim().toLowerCase();
  if (EXPERIENCE_TO_LEVEL[key]) return EXPERIENCE_TO_LEVEL[key];
  const slug = key.replace(/\s+/g, "_");
  if (slug.includes("advanced") || slug.includes("3")) return "advanced";
  if (slug.includes("intermediate") || slug.includes("year")) return "intermediate";
  return "beginner";
}

/** Intake score fallback when experience_level is missing (matches assign_or_rotate_plans). */
export function levelFromIntakeScore(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 30) return "advanced";
  if (s >= 20) return "intermediate";
  return "beginner";
}

function normalizeGoal(raw: string | null | undefined): string {
  if (!raw?.trim()) return "general_fitness";
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return sanitizeMemberTags(
    value
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim().toLowerCase().replace(/\s+/g, "_")),
  );
}

function healthConstraints(health: Record<string, unknown> | null): string[] {
  if (!health) return [];
  const tags: string[] = [];
  if (health.heart_condition === true || health.heart_condition === "true") {
    tags.push("heart_condition");
  }
  if (health.chest_pain_when_active === true || health.chest_pain_when_active === "true") {
    tags.push("chest_pain");
  }
  const notes = typeof health.medications_notes === "string" ? health.medications_notes : "";
  if (notes.toLowerCase().includes("knee")) tags.push("knee_injury");
  if (notes.toLowerCase().includes("back")) tags.push("back_injury");
  if (notes.toLowerCase().includes("shoulder")) tags.push("shoulder_injury");
  return tags;
}

/**
 * Hydrate {@link UserProfile} from Supabase intake + profile vitals.
 * **Reuse:** Called before {@link getPlanForUser} in assign flow.
 */
export async function buildUserProfileFromIntake(
  supabase: SupabaseClient,
  profileId: string,
  outletId: string,
): Promise<UserProfile | null> {
  const [{ data: profile }, { data: responses }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, gender, date_of_birth, height_cm, weight_kg")
      .eq("id", profileId)
      .maybeSingle(),
    supabase
      .from("questions_responses")
      .select("form_name, answers_json, intake_score")
      .eq("profile_id", profileId)
      .eq("outlet_id", outletId)
      .eq("is_complete", true)
      .is("deleted_at", null)
      .in("form_name", ["basic_info", "health_screening", "diet_preferences"]),
  ]);

  if (!profile) return null;

  const byForm = Object.fromEntries(
    (responses ?? []).map((r) => [r.form_name, r.answers_json as Record<string, unknown>]),
  );
  const basic = (byForm.basic_info ?? {}) as Record<string, unknown>;
  const health = (byForm.health_screening ?? {}) as Record<string, unknown>;
  const diet = (byForm.diet_preferences ?? {}) as Record<string, unknown>;

  const intakeScore =
    (responses ?? []).find((r) => r.form_name === "basic_info")?.intake_score ?? undefined;

  let age: number | undefined;
  if (profile.date_of_birth) {
    const dob = new Date(profile.date_of_birth);
    age = new Date().getFullYear() - dob.getFullYear();
  }

  let bmi: number | undefined;
  if (profile.height_cm && profile.weight_kg && profile.height_cm > 0) {
    bmi = profile.weight_kg / (profile.height_cm / 100) ** 2;
  }

  const experienceRaw =
    (basic.experience_level as string | undefined) ??
    (basic.fitness_level as string | undefined);

  const level =
    experienceRaw != null
      ? mapExperienceToLevel(experienceRaw)
      : levelFromIntakeScore(intakeScore ?? null);

  const allergies = parseStringArray(diet.food_allergies);
  const injuries = sanitizeMemberTags(healthConstraints(health));

  const dietPreferenceRaw =
    (diet.diet_type as string | undefined) ??
    (Array.isArray(diet.diet_pattern) ? diet.diet_pattern[0] : diet.diet_pattern) ??
    null;

  const dietPreference = mapDietTypeTag(dietPreferenceRaw) ?? dietPreferenceRaw;

  return {
    profileId,
    outletId,
    goal: normalizeGoal(basic.fitness_goal as string | undefined),
    level,
    gender: (profile.gender as string | undefined)?.toLowerCase() ?? "any",
    injuries,
    allergies,
    dietPreference,
    equipment: parseStringArray(basic.available_equipment),
    intakeScore: intakeScore ?? undefined,
    age,
    bmi,
  };
}
