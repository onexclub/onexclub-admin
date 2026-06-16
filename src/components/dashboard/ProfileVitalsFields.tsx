import { MEMBER_INTAKE_GENDER_OPTIONS, type ProfileVitalsSnapshot } from "@/lib/profile/vitals";

const fieldCn =
  "mt-1 w-full max-w-md rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

type Props = {
  /** When set, pre-fills inputs (membership edit). Omit for new-member wizard defaults. */
  defaults?: Partial<ProfileVitalsSnapshot> | null;
  /** Tighter layout inside the onboard wizard card. */
  variant?: "detail" | "wizard";
};

/**
 * Shared inputs for `profiles.date_of_birth`, `gender`, `height_cm`, `weight_kg`.
 * BMI is computed in Postgres — not posted from the browser.
 */
export function ProfileVitalsFields({ defaults, variant = "detail" }: Props) {
  const labelCn =
    variant === "wizard"
      ? "flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100"
      : "block text-sm font-medium text-zinc-800 dark:text-zinc-100";

  const inputCn = variant === "wizard" ? fieldCn.replace("max-w-md", "") : fieldCn;

  return (
    <fieldset className="space-y-3 border-0 p-0">
      <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Health & body metrics</legend>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Used for intake, training plans, and progress tracking. BMI updates automatically when height and weight are saved.
      </p>

      <label className={labelCn}>
        Date of birth
        <input
          name="date_of_birth"
          type="date"
          defaultValue={defaults?.date_of_birth ?? ""}
          className={inputCn}
        />
      </label>

      <label className={labelCn}>
        Gender (required)
        <div className="mt-2 grid grid-cols-3 gap-2">
          {MEMBER_INTAKE_GENDER_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:has-[:checked]:border-orange-500 dark:has-[:checked]:bg-orange-950/40"
            >
              <input
                type="radio"
                name="gender"
                value={o.value}
                defaultChecked={defaults?.gender === o.value}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCn}>
          Height (cm)
          <input
            name="height_cm"
            type="number"
            min={50}
            max={280}
            step={0.1}
            inputMode="decimal"
            placeholder="e.g. 172"
            defaultValue={defaults?.height_cm != null ? String(defaults.height_cm) : ""}
            className={inputCn}
          />
        </label>
        <label className={labelCn}>
          Weight (kg)
          <input
            name="weight_kg"
            type="number"
            min={20}
            max={400}
            step={0.1}
            inputMode="decimal"
            placeholder="e.g. 68.5"
            defaultValue={defaults?.weight_kg != null ? String(defaults.weight_kg) : ""}
            className={inputCn}
          />
        </label>
      </div>
    </fieldset>
  );
}
