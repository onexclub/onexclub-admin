import type { QuestionDefinition } from "./types";

export type SectionCompletion = {
  requiredAnswered: number;
  requiredTotal: number;
  optionalAnswered: number;
  optionalTotal: number;
  percentRequired: number;
};

function isProvided(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function computeSectionCompletion(defs: QuestionDefinition[], answers: Record<string, unknown>): SectionCompletion {
  let requiredTotal = 0;
  let requiredAnswered = 0;
  let optionalTotal = 0;
  let optionalAnswered = 0;

  for (const d of defs) {
    const v = answers[d.question_key];
    const ok = isProvided(v);
    if (d.is_required) {
      requiredTotal += 1;
      if (ok) requiredAnswered += 1;
    } else {
      optionalTotal += 1;
      if (ok) optionalAnswered += 1;
    }
  }

  const percentRequired =
    requiredTotal === 0 ? 100 : Math.round((requiredAnswered / Math.max(requiredTotal, 1)) * 100);

  return {
    requiredAnswered,
    requiredTotal,
    optionalAnswered,
    optionalTotal,
    percentRequired,
  };
}
