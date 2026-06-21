import type { SupabaseClient } from "@supabase/supabase-js";

import { inferTemplateDietType } from "./diet-compatibility";
import type { PlanTemplateRow } from "./types";

const EGG_FOOD_PATTERN =
  /\b(egg|eggs|anda|andaa|bhurji|omelette|omelet|boiled egg|egg white)\b/i;

export function mealFoodsContainEgg(foods: unknown): boolean {
  if (foods == null) return false;
  const text = typeof foods === "string" ? foods : JSON.stringify(foods);
  return EGG_FOOD_PATTERN.test(text);
}

export async function templateHasEggMeals(
  supabase: SupabaseClient,
  templateId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("meal_items")
    .select("foods, plan_days!inner(plan_weeks!inner(plan_template_id))")
    .eq("plan_days.plan_weeks.plan_template_id", templateId)
    .limit(80);

  if (error || !data?.length) return false;
  return data.some((row) => mealFoodsContainEgg(row.foods));
}

/**
 * Vegetarian + eats eggs → prefer eggetarian-tagged or verified egg-inclusive meals.
 * Vegetarian + no eggs → drop eggetarian templates and any plan with egg items.
 */
export async function filterByVegetarianEggPreference(
  supabase: SupabaseClient,
  candidates: PlanTemplateRow[],
  eatsEggs: boolean,
): Promise<PlanTemplateRow[]> {
  if (!candidates.length) return candidates;

  const verified: PlanTemplateRow[] = [];
  for (const template of candidates) {
    const templateDiet = inferTemplateDietType(template);
    const hasEggs = await templateHasEggMeals(supabase, template.id);

    if (eatsEggs) {
      // Eggetarian tag or vegetarian catalogue with eggs in meals
      if (templateDiet === "eggetarian" || hasEggs) {
        verified.push(template);
      }
    } else {
      if (templateDiet === "eggetarian") continue;
      if (!hasEggs) verified.push(template);
    }
  }
  return verified;
}

/** @deprecated Use filterByVegetarianEggPreference — kept for legacy eggetarian slug callers. */
export async function filterEggetarianByMealContent(
  supabase: SupabaseClient,
  candidates: PlanTemplateRow[],
  userDietTag: string,
): Promise<PlanTemplateRow[]> {
  if (userDietTag !== "eggetarian") return candidates;
  return filterByVegetarianEggPreference(supabase, candidates, true);
}
