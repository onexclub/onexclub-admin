import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveMemberDietFromProfile } from "./resolve-diet-preference";
import type { AiGeneratedPlanPayload, PlanTemplateRow, PlanTemplateType, UserProfile } from "./types";

/** Insert AI-generated plan into plan_templates + nested weeks/days/items.
 *
 * **Catalog reuse:** Row lives in `plan_templates` (not per-user). Same hard-filter
 * fields as manual templates — once staff approves (`status = active`), future members
 * with matching goal/level/gender/diet get it free with zero LLM cost.
 */
export async function insertAiGeneratedTemplate(
  supabase: SupabaseClient,
  userProfile: UserProfile,
  templateType: PlanTemplateType,
  payload: AiGeneratedPlanPayload,
): Promise<PlanTemplateRow> {
  const memberConstraints = [...new Set([...userProfile.injuries, ...userProfile.allergies])];
  const resolved = resolveMemberDietFromProfile(userProfile);
  const dietTags: string[] = [];
  if (resolved.baseDiet !== "no_restrictions") {
    if (resolved.baseDiet === "vegetarian" && resolved.eatsEggs) {
      dietTags.push("eggetarian");
    } else {
      dietTags.push(resolved.baseDiet);
    }
  }
  if (resolved.specialDiet) dietTags.push(resolved.specialDiet);

  const { data: template, error: templateErr } = await supabase
    .from("plan_templates")
    .insert({
      outlet_id: userProfile.outletId,
      plan_type: templateType,
      name: payload.name.trim(),
      description: payload.description ?? null,
      difficulty_level: userProfile.level,
      duration_weeks: payload.duration_weeks,
      primary_goal: userProfile.goal,
      target_gender: userProfile.gender === "any" ? null : userProfile.gender,
      tags:
        templateType === "diet"
          ? ["ai_generated", userProfile.goal, ...dietTags]
          : ["ai_generated", userProfile.goal],
      constraints: memberConstraints,
      source: "ai_generated",
      status: "pending_review",
      created_by_ai_at: new Date().toISOString(),
      is_active: true,
      min_score: 0,
      max_score: 100,
    })
    .select(
      "id,outlet_id,plan_type,name,description,difficulty_level,duration_weeks,primary_goal,target_gender,min_age,max_age,min_bmi,max_bmi,min_score,max_score,tags,constraints,source,status,match_count,is_active",
    )
    .single();

  if (templateErr || !template) {
    throw new Error(templateErr?.message ?? "Failed to insert AI template");
  }

  for (const week of payload.weeks) {
    const { data: weekRow, error: weekErr } = await supabase
      .from("plan_weeks")
      .insert({
        plan_template_id: template.id,
        week_number: week.week_number,
        title: week.title ?? `Week ${week.week_number}`,
        overview: week.overview ?? null,
        display_order: week.week_number,
      })
      .select("id")
      .single();

    if (weekErr || !weekRow) continue;

    for (const day of week.days) {
      const { data: dayRow, error: dayErr } = await supabase
        .from("plan_days")
        .insert({
          plan_week_id: weekRow.id,
          day_number: day.day_number,
          day_label: day.day_label ?? `Day ${day.day_number}`,
          is_rest_day: day.is_rest_day ?? false,
          overview: day.overview ?? null,
          display_order: day.day_number,
        })
        .select("id")
        .single();

      if (dayErr || !dayRow) continue;

      if (day.targets) {
        await supabase.from("plan_daily_targets").insert({
          plan_day_id: dayRow.id,
          ...day.targets,
        });
      }

      if (templateType === "diet" && day.meals?.length) {
        await supabase.from("meal_items").insert(
          day.meals.map((meal, idx) => ({
            plan_day_id: dayRow.id,
            display_order: idx + 1,
            meal_name: meal.meal_name,
            meal_time: meal.meal_time ?? null,
            meal_type: meal.meal_type ?? null,
            foods: meal.foods ?? [],
            calories: meal.calories ?? null,
            protein_g: meal.protein_g ?? null,
            carbs_g: meal.carbs_g ?? null,
            fat_g: meal.fat_g ?? null,
            preparation_note: meal.preparation_note ?? null,
          })),
        );
      }

      if (templateType === "exercise" && day.exercises?.length) {
        await supabase.from("exercise_items").insert(
          day.exercises.map((ex, idx) => ({
            plan_day_id: dayRow.id,
            display_order: idx + 1,
            exercise_name: ex.exercise_name,
            muscle_group: ex.muscle_group ?? null,
            equipment: ex.equipment ?? null,
            category: ex.category ?? null,
            sets: ex.sets ?? null,
            reps: ex.reps ?? null,
            duration_seconds: ex.duration_seconds ?? null,
            rest_seconds: ex.rest_seconds ?? null,
            instructions: ex.instructions ?? null,
            tips: ex.tips ?? null,
          })),
        );
      }
    }
  }

  return template as unknown as PlanTemplateRow;
}
