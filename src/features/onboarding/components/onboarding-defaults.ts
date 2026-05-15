import type { QuestionDefinition } from "@/features/onboarding/types";

function numericBounds(def: QuestionDefinition): { min: number; max: number } | null {
  const raw = def.validation_json;
  if (!raw) return null;
  const min = typeof raw.min === "number" ? raw.min : null;
  const max = typeof raw.max === "number" ? raw.max : null;
  if (min == null || max == null) return null;
  return { min, max };
}

/** Builds stable default shapes for react-hook-form from definitions + persisted JSON. */
export function buildAnswersDefaultValues(defs: QuestionDefinition[], existing: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };
  for (const d of defs) {
    const current = next[d.question_key];
    const hasMeaning =
      current !== undefined &&
      current !== null &&
      !(typeof current === "string" && current.trim().length === 0) &&
      !(Array.isArray(current) && current.length === 0 && d.input_type === "multiselect");
    if (hasMeaning) continue;

    switch (d.input_type) {
      case "boolean":
        next[d.question_key] = false;
        break;
      case "multiselect":
        next[d.question_key] = [];
        break;
      case "scale": {
        const bounds =
          numericBounds(d) ??
          ({
            min: 0,
            max: 10,
          } as const);
        next[d.question_key] = Math.round((bounds.min + bounds.max) / 2);
        break;
      }
      case "number": {
        const bounds = numericBounds(d);
        next[d.question_key] = bounds?.min ?? 0;
        break;
      }
      default:
        next[d.question_key] = "";
    }
  }
  return next;
}
