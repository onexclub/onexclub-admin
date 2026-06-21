import type { AiGeneratedPlanPayload } from "../types";

/** Parse and minimally validate AI JSON before DB insert. */
export function parseAiPlanJson(raw: string): AiGeneratedPlanPayload {
  const parsed = JSON.parse(raw) as AiGeneratedPlanPayload;
  if (!parsed.name?.trim()) throw new Error("Missing plan name");
  if (!Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
    throw new Error("Plan must include at least one week");
  }
  if (!parsed.duration_weeks || parsed.duration_weeks < 1) {
    parsed.duration_weeks = parsed.weeks.length;
  }
  for (const week of parsed.weeks) {
    if (!Array.isArray(week.days) || week.days.length === 0) {
      throw new Error(`Week ${week.week_number} must include days`);
    }
  }
  return parsed;
}
