import {
  formatBmi,
  formatDateOfBirth,
  formatHeightCm,
  formatWeightKg,
  genderLabel,
  type ProfileVitalsSnapshot,
} from "@/lib/profile/vitals";

/** Read-only vitals block for onboarding summary and overview side panels. */
export function ProfileVitalsSummary({ vitals }: { vitals: ProfileVitalsSnapshot | null | undefined }) {
  const v = vitals ?? {
    date_of_birth: null,
    gender: null,
    height_cm: null,
    weight_kg: null,
    bmi: null,
  };

  const hasAny =
    v.date_of_birth != null ||
    v.gender != null ||
    v.height_cm != null ||
    v.weight_kg != null ||
    v.bmi != null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Health & body metrics</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Stored on the member profile — capture during add-member or update from Overview → Contact & member details.
      </p>
      {!hasAny ? (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">Not recorded yet.</p>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Date of birth</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDateOfBirth(v.date_of_birth)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Gender</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{genderLabel(v.gender)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Height</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatHeightCm(v.height_cm)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Weight</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatWeightKg(v.weight_kg)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">BMI</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatBmi(v.bmi)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
