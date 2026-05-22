/** Live BMI band labels for onboarding + profile vitals UI. */

export type BmiBand = "underweight" | "normal" | "overweight" | "obese";

export const BMI_BAND_LABEL: Record<BmiBand, string> = {
  underweight: "Underweight",
  normal: "Normal",
  overweight: "Overweight",
  obese: "Obese",
};

export function classifyBmi(bmi: number | null | undefined): BmiBand | null {
  if (bmi == null || !Number.isFinite(bmi)) return null;
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

/** Tailwind semantic token class names for the colored band chip. */
export function bmiBandTone(band: BmiBand | null): {
  chip: string;
  bar: string;
} {
  switch (band) {
    case "underweight":
      return { chip: "bg-warning-soft text-warning", bar: "bg-warning" };
    case "normal":
      return { chip: "bg-success-soft text-success", bar: "bg-orange-500" };
    case "overweight":
      return { chip: "bg-warning-soft text-warning", bar: "bg-warning" };
    case "obese":
      return { chip: "bg-danger-soft text-danger", bar: "bg-danger" };
    default:
      return { chip: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400", bar: "bg-zinc-300 dark:bg-zinc-600" };
  }
}
