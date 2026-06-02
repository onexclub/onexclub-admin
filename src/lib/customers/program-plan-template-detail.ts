import type { SupabaseClient } from "@supabase/supabase-js";

/** One meal row from `meal_items` — linked to `plan_days`. */
export type ProgramMealItem = {
  id: string;
  meal_name: string;
  meal_time: string | null;
  meal_type: string | null;
  foods: unknown;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  preparation_note: string | null;
};

/** One exercise row from `exercise_items` — linked to `plan_days`. */
export type ProgramExerciseItem = {
  id: string;
  exercise_name: string;
  muscle_group: string | null;
  equipment: string | null;
  category: string | null;
  sets: number | null;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number | null;
  instructions: string | null;
  tips: string | null;
};

export type ProgramDayDetail = {
  id: string;
  day_number: number;
  day_label: string | null;
  is_rest_day: boolean;
  overview: string | null;
  meals: ProgramMealItem[];
  exercises: ProgramExerciseItem[];
  targets: {
    target_calories: number | null;
    target_protein_g: number | null;
    target_carbs_g: number | null;
    target_fat_g: number | null;
    target_water_ml: number | null;
    target_steps: number | null;
  } | null;
};

export type ProgramWeekDetail = {
  id: string;
  week_number: number;
  title: string | null;
  overview: string | null;
  days: ProgramDayDetail[];
};

export type ProgramPlanTemplateDetail = {
  id: string;
  plan_type: string;
  name: string;
  description: string | null;
  difficulty_level: string;
  duration_weeks: number | null;
  primary_goal: string | null;
  tags: string[] | null;
  weeks: ProgramWeekDetail[];
};

type RawMeal = ProgramMealItem & { display_order?: number };
type RawExercise = ProgramExerciseItem & { display_order?: number };
type RawTargets = ProgramDayDetail["targets"] & { id?: string };
type RawDay = Omit<ProgramDayDetail, "meals" | "exercises" | "targets"> & {
  display_order?: number;
  meal_items?: RawMeal[] | null;
  exercise_items?: RawExercise[] | null;
  plan_daily_targets?: RawTargets | RawTargets[] | null;
};
type RawWeek = Omit<ProgramWeekDetail, "days"> & {
  display_order?: number;
  plan_days?: RawDay[] | null;
};

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapDay(raw: RawDay): ProgramDayDetail {
  const meals = [...(raw.meal_items ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const exercises = [...(raw.exercise_items ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const targetsRaw = firstOrSelf(raw.plan_daily_targets);

  return {
    id: raw.id,
    day_number: raw.day_number,
    day_label: raw.day_label,
    is_rest_day: raw.is_rest_day,
    overview: raw.overview,
    meals: meals.map(({ display_order: _d, ...m }) => m),
    exercises: exercises.map(({ display_order: _d, ...e }) => e),
    targets: targetsRaw
      ? {
          target_calories: targetsRaw.target_calories,
          target_protein_g: targetsRaw.target_protein_g,
          target_carbs_g: targetsRaw.target_carbs_g,
          target_fat_g: targetsRaw.target_fat_g,
          target_water_ml: targetsRaw.target_water_ml,
          target_steps: targetsRaw.target_steps,
        }
      : null,
  };
}

/**
 * Full template structure for the plan detail modal.
 * **Reuse:** `CustomerProgramPlanDetailDialog` lazy-loads via server action.
 */
export async function fetchProgramPlanTemplateDetail(
  supabase: SupabaseClient,
  templateId: string,
): Promise<ProgramPlanTemplateDetail | null> {
  const { data, error } = await supabase
    .from("plan_templates")
    .select(
      [
        "id",
        "plan_type",
        "name",
        "description",
        "difficulty_level",
        "duration_weeks",
        "primary_goal",
        "tags",
        "plan_weeks(id,week_number,title,overview,display_order,plan_days(id,day_number,day_label,is_rest_day,overview,display_order,meal_items(id,meal_name,meal_time,meal_type,foods,calories,protein_g,carbs_g,fat_g,preparation_note,display_order),exercise_items(id,exercise_name,muscle_group,equipment,category,sets,reps,duration_seconds,rest_seconds,instructions,tips,display_order),plan_daily_targets(target_calories,target_protein_g,target_carbs_g,target_fat_g,target_water_ml,target_steps)))",
      ].join(","),
    )
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const raw = data as unknown as ProgramPlanTemplateDetail & { plan_weeks?: RawWeek[] | null };
  const weeks = [...(raw.plan_weeks ?? [])]
    .sort((a, b) => (a.display_order ?? a.week_number) - (b.display_order ?? b.week_number))
    .map((week) => ({
      id: week.id,
      week_number: week.week_number,
      title: week.title,
      overview: week.overview,
      days: [...(week.plan_days ?? [])]
        .sort((a, b) => (a.display_order ?? a.day_number) - (b.display_order ?? b.day_number))
        .map(mapDay),
    }));

  return {
    id: raw.id,
    plan_type: raw.plan_type,
    name: raw.name,
    description: raw.description,
    difficulty_level: raw.difficulty_level,
    duration_weeks: raw.duration_weeks,
    primary_goal: raw.primary_goal,
    tags: raw.tags,
    weeks,
  };
}

/**
 * One food line inside `meal_items.foods` JSONB — stored as object array in Supabase seed data.
 * Example: `{ "name": "Oats", "qty": "60g", "calories": 175, "protein_g": 8, ... }`
 */
export type MealFoodEntry = {
  name?: string;
  qty?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

/** Parse `meal_items.foods` whether JSON object array, plain strings, or legacy text. */
export function parseMealFoods(foods: unknown): MealFoodEntry[] {
  if (foods == null) return [];
  if (typeof foods === "string") {
    return foods.trim().length ? [{ name: foods.trim() }] : [];
  }
  if (!Array.isArray(foods)) return [];

  return foods
    .map((entry): MealFoodEntry | null => {
      if (typeof entry === "string" && entry.trim().length) {
        return { name: entry.trim() };
      }
      if (typeof entry === "object" && entry !== null && "name" in entry) {
        const raw = entry as Record<string, unknown>;
        return {
          name: typeof raw.name === "string" ? raw.name : undefined,
          qty: typeof raw.qty === "string" ? raw.qty : undefined,
          calories: typeof raw.calories === "number" ? raw.calories : undefined,
          protein_g: typeof raw.protein_g === "number" ? raw.protein_g : undefined,
          carbs_g: typeof raw.carbs_g === "number" ? raw.carbs_g : undefined,
          fat_g: typeof raw.fat_g === "number" ? raw.fat_g : undefined,
        };
      }
      return null;
    })
    .filter((e): e is MealFoodEntry => e != null && Boolean(e.name?.trim()));
}

/** Human label for `meal_type` slugs like `evening_snack`. */
export function formatMealTypeLabel(mealType: string | null | undefined): string {
  if (!mealType?.length) return "";
  return mealType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Schedule position within the program (0% at week 1 day 1 — not "half done"). */
export function computeProgramSchedulePercent(
  currentWeek: number,
  currentDay: number,
  durationWeeks: number | null,
  daysPerWeek = 7,
): number | null {
  if (!durationWeeks || durationWeeks <= 0) return null;
  const totalDays = durationWeeks * daysPerWeek;
  const elapsedDays = Math.max(0, (currentWeek - 1) * daysPerWeek + Math.max(0, currentDay - 1));
  if (totalDays <= 0) return null;
  return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
}
