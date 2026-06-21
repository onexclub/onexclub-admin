"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, X } from "lucide-react";

import { loadProgramPlanTemplateDetailAction } from "@/app/admin/customers/program-plan-detail-action";
import type { ProgramPlanDetailSelection } from "@/lib/customers/program-plan-detail-selection";
import { Badge } from "@/components/ui/badge";
import { formatProgramGoal } from "@/lib/customers/customer-program-plans";
import { textForPlanUi } from "@/lib/customers/format-plan-description";
import type { ProgramPlanTemplateDetail } from "@/lib/customers/program-plan-template-detail";
import { formatMealTypeLabel, parseMealFoods } from "@/lib/customers/program-plan-template-detail";
import { cn } from "@/lib/utils/cn";

/**
 * Full-screen modal for exercise/diet template structure (weeks → days → items).
 *
 * **Reuse:**
 * - {@link CustomerProgramPlansPanel} (member assignment cards)
 * - {@link ProgramPlanCatalogClient} (admin catalogue browse)
 */
export function ProgramPlanTemplateDetailDialog(props: {
  open: boolean;
  selection: ProgramPlanDetailSelection | null;
  onClose: () => void;
}) {
  const { open, selection, onClose } = props;
  const [detail, setDetail] = useState<ProgramPlanTemplateDetail | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selection) {
      setDetail(null);
      setExpandedWeek(1);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("template_id", selection.templateId);
    fd.set("outlet_id", selection.outletId);

    loadProgramPlanTemplateDetailAction({}, fd)
      .then((result) => {
        if (cancelled) return;
        if (result.error) setError(result.error);
        if (result.detail) setDetail(result.detail);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selection]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !selection) return null;

  const isExercise = selection.planType === "exercise";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="program-plan-detail-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 sm:rounded-2xl">
        <div
          className={cn(
            "border-b px-5 py-4 sm:px-6",
            isExercise
              ? "border-violet-200/80 bg-gradient-to-r from-violet-50 to-white dark:border-violet-900/40 dark:from-violet-950/40 dark:to-zinc-950"
              : "border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-zinc-950",
          )}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:bg-white/80 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isExercise ? "Exercise program" : "Diet program"}
          </p>
          <h2 id="program-plan-detail-title" className="mt-1 pr-10 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {selection.templateName}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{formatProgramGoal(selection.primaryGoal)}</Badge>
            <Badge variant="default">{selection.tierLabel}</Badge>
            {selection.durationWeeks ? (
              <Badge variant="outline">{selection.durationWeeks} weeks</Badge>
            ) : null}
          </div>
          {selection.templateDescription ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{selection.templateDescription}</p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {loading && !detail ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading plan structure…
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
              {error}
            </p>
          ) : null}

          {detail?.weeks.length ? (
            <div className="space-y-3">
              {detail.weeks.map((week) => {
                const openWeek = expandedWeek === week.week_number;
                const weekTitle = textForPlanUi(week.title);
                return (
                  <div
                    key={week.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 bg-zinc-50/80 px-4 py-3 text-left dark:bg-zinc-900/40"
                      onClick={() => setExpandedWeek(openWeek ? null : week.week_number)}
                    >
                      {openWeek ? (
                        <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-zinc-500" />
                      )}
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        Week {week.week_number}
                        {weekTitle ? ` · ${weekTitle}` : ""}
                      </span>
                      <span className="ml-auto text-xs text-zinc-500">{week.days.length} days</span>
                    </button>
                    {openWeek ? (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {week.days.map((day) => (
                          <div key={day.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Day {day.day_number}
                                {day.day_label ? ` · ${day.day_label}` : ""}
                              </p>
                              {day.is_rest_day ? <Badge variant="warning">Rest</Badge> : null}
                            </div>
                            {(() => {
                              const overview = textForPlanUi(day.overview);
                              return overview ? (
                                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{overview}</p>
                              ) : null;
                            })()}

                            {day.targets && !isExercise ? (
                              <p className="mt-2 text-xs text-zinc-500">
                                Targets:{" "}
                                {[
                                  day.targets.target_calories != null ? `${day.targets.target_calories} kcal` : null,
                                  day.targets.target_protein_g != null ? `${day.targets.target_protein_g}g protein` : null,
                                  day.targets.target_water_ml != null ? `${day.targets.target_water_ml}ml water` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                            ) : null}

                            {isExercise && day.exercises.length > 0 ? (
                              <ul className="mt-3 space-y-2">
                                {day.exercises.map((ex) => (
                                  <li
                                    key={ex.id}
                                    className="rounded-lg border border-zinc-100 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30"
                                  >
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{ex.exercise_name}</p>
                                    <p className="text-xs text-zinc-500">
                                      {[ex.muscle_group, ex.equipment, ex.sets != null ? `${ex.sets} sets` : null, ex.reps ? `${ex.reps} reps` : null]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                    {ex.instructions ? (
                                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{ex.instructions}</p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                            {!isExercise && day.meals.length > 0 ? (
                              <ul className="mt-3 space-y-2">
                                {day.meals.map((meal) => {
                                  const foodItems = parseMealFoods(meal.foods);
                                  return (
                                    <li
                                      key={meal.id}
                                      className="rounded-lg border border-zinc-100 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{meal.meal_name}</p>
                                        {meal.meal_type ? (
                                          <Badge variant="outline" className="text-[10px]">
                                            {formatMealTypeLabel(meal.meal_type)}
                                          </Badge>
                                        ) : null}
                                      </div>
                                      {meal.meal_time ? (
                                        <p className="text-xs text-zinc-500">{meal.meal_time}</p>
                                      ) : null}
                                      {foodItems.length > 0 ? (
                                        <ul className="mt-2 space-y-1">
                                          {foodItems.map((food, idx) => (
                                            <li
                                              key={`${meal.id}-food-${idx}`}
                                              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400"
                                            >
                                              <span>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                                  {food.name}
                                                </span>
                                                {food.qty ? (
                                                  <span className="text-zinc-500"> · {food.qty}</span>
                                                ) : null}
                                              </span>
                                              {food.calories != null ? (
                                                <span className="tabular-nums text-zinc-500">{food.calories} kcal</span>
                                              ) : null}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : null}
                                      {(() => {
                                        const note = textForPlanUi(meal.preparation_note);
                                        return note ? (
                                          <p className="mt-2 text-xs italic text-zinc-500">{note}</p>
                                        ) : null;
                                      })()}
                                      <p className="mt-2 text-xs font-medium text-zinc-500">
                                        Meal total:{" "}
                                        {[
                                          meal.calories != null ? `${meal.calories} kcal` : null,
                                          meal.protein_g != null ? `${meal.protein_g}g protein` : null,
                                          meal.carbs_g != null ? `${meal.carbs_g}g carbs` : null,
                                          meal.fat_g != null ? `${meal.fat_g}g fat` : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || "—"}
                                      </p>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}

                            {!day.is_rest_day &&
                            ((isExercise && !day.exercises.length) || (!isExercise && !day.meals.length)) ? (
                              <p className="mt-2 text-xs italic text-zinc-400">No items listed for this day.</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : !loading && !error ? (
            <p className="py-8 text-center text-sm text-zinc-500">No weekly structure published for this template yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
