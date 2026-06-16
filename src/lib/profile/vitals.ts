/**
 * Member body metrics + demographics on `profiles` (BMI is DB-generated from height/weight).
 *
 * **Reuse:** `AddCustomerOnboardWizard`, `onboardMemberWizardAction`, `updateCustomerProfileAction`,
 * `CustomerMembershipWorkspace`.
 */

import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";

/** Matches Postgres `gender_type` enum in the Gym SaaS schema. */
export const PROFILE_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

/**
 * Member intake + identity edit — same three choices as the add-customer wizard.
 * **Reuse:** `CustomerOnboardWizard`, `CustomerMembershipWorkspace` identity edit.
 * Roster filters / admin views may still use full {@link PROFILE_GENDER_OPTIONS}.
 */
export const MEMBER_INTAKE_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

export type MemberIntakeGender = (typeof MEMBER_INTAKE_GENDER_OPTIONS)[number]["value"];

const MEMBER_INTAKE_GENDER_SET = new Set<string>(MEMBER_INTAKE_GENDER_OPTIONS.map((o) => o.value));

/** Maps stored profile gender to intake/edit UI (legacy `prefer_not_to_say` → `other`). */
export function genderForIntakeForm(value: string | null | undefined): MemberIntakeGender | "" {
  if (!value) return "";
  if (MEMBER_INTAKE_GENDER_SET.has(value)) return value as MemberIntakeGender;
  if (value === "prefer_not_to_say") return "other";
  return "";
}

export type ProfileGender = (typeof PROFILE_GENDER_OPTIONS)[number]["value"];

const GENDER_SET = new Set<string>(PROFILE_GENDER_OPTIONS.map((o) => o.value));

/** Append to `profiles!profile_id(...)` selects wherever vitals are shown or edited. */
export const PROFILE_VITALS_SELECT = "date_of_birth,gender,height_cm,weight_kg,bmi" as const;

/** Contact + vitals columns for membership detail / onboarding summary embeds. */
export const PROFILE_CONTACT_AND_VITALS_SELECT =
  `full_name,email,phone,${PROFILE_VITALS_SELECT}` as const;

export type ProfileVitalsSnapshot = {
  date_of_birth: string | null;
  gender: ProfileGender | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
};

export type ProfileVitalsPatch = {
  date_of_birth: string | null;
  gender: ProfileGender | null;
  height_cm: number | null;
  weight_kg: number | null;
};

function parseOptionalPositiveNumber(
  raw: string,
  label: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (!raw.length) return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} must be a number.` };
  }
  if (n < min || n > max) {
    return { ok: false, error: `${label} must be between ${min} and ${max}.` };
  }
  return { ok: true, value: Math.round(n * 10) / 10 };
}

/**
 * Reads `date_of_birth`, `gender`, `height_cm`, `weight_kg` from a form post.
 * Empty fields become `null` so staff can clear values on edit (unless `mode: "onboard"`).
 */
export function parseProfileVitalsFromFormData(
  formData: FormData,
  options?: { mode?: "edit" | "onboard" },
): { ok: true; patch: ProfileVitalsPatch } | { ok: false; error: string } {
  const onboard = options?.mode === "onboard";
  const dobRaw = String(formData.get("date_of_birth") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const heightRaw = String(formData.get("height_cm") ?? "").trim();
  const weightRaw = String(formData.get("weight_kg") ?? "").trim();

  let date_of_birth: string | null = null;
  if (dobRaw.length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
      return { ok: false, error: "Date of birth must be YYYY-MM-DD." };
    }
    const parsed = new Date(`${dobRaw}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Date of birth is not a valid calendar date." };
    }
    date_of_birth = dobRaw;
  }

  if (onboard && !genderRaw.length) {
    return { ok: false, error: "Gender is required." };
  }

  let gender: ProfileGender | null = null;
  if (genderRaw.length > 0) {
    if (!GENDER_SET.has(genderRaw)) {
      return { ok: false, error: "Please choose a valid gender option." };
    }
    gender = genderRaw as ProfileGender;
  }

  if (onboard && !heightRaw.length) {
    return { ok: false, error: "Height (cm) is required." };
  }
  if (onboard && !weightRaw.length) {
    return { ok: false, error: "Weight (kg) is required." };
  }

  const height = parseOptionalPositiveNumber(heightRaw, "Height (cm)", 50, 280);
  if (!height.ok) return height;
  const weight = parseOptionalPositiveNumber(weightRaw, "Weight (kg)", 20, 400);
  if (!weight.ok) return weight;

  return {
    ok: true,
    patch: {
      date_of_birth,
      gender,
      height_cm: height.value,
      weight_kg: weight.value,
    },
  };
}

export function genderLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const hit = PROFILE_GENDER_OPTIONS.find((o) => o.value === value);
  return hit?.label ?? value;
}

/** Client-side BMI hint when DB value is not loaded yet. */
export function computeBmiFromMetrics(heightCm: number | null, weightKg: number | null): number | null {
  if (heightCm == null || weightKg == null || heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function formatBmi(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function formatHeightCm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value} cm`;
}

export function formatWeightKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value} kg`;
}

/** Whole years from `profiles.date_of_birth` (YYYY-MM-DD); `null` when unknown or invalid. */
export function computeAgeFromDateOfBirth(dob: string | null | undefined): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const birth = new Date(`${dob}T12:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 150 ? age : null;
}

/** Compact roster subline, e.g. `28 yrs · Male` or `—` when both missing. */
export function formatAgeAndGender(
  dob: string | null | undefined,
  gender: string | null | undefined,
): string {
  const parts: string[] = [];
  const age = computeAgeFromDateOfBirth(dob);
  if (age != null) parts.push(`${age} yrs`);
  const g = genderLabel(gender);
  if (g !== "—") parts.push(g);
  return parts.length ? parts.join(" · ") : "—";
}

/** Display label for `profiles.date_of_birth` (`YYYY-MM-DD`). SSR-safe — see `formatMembershipTimestampUtcLabel`. */
export function formatDateOfBirth(value: string | null | undefined): string {
  if (!value) return "—";
  // Noon UTC anchor keeps the calendar day stable across timezones (same pattern as age helpers above).
  return formatMembershipTimestampUtcLabel(`${value}T12:00:00.000Z`);
}
