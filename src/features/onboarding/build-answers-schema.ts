import { z } from "zod";

import type { QuestionDefinition } from "./types";

function numericBounds(d: QuestionDefinition): { min: number; max: number; step?: number } | null {
  const raw = d.validation_json;
  if (!raw) return null;
  const min = typeof raw.min === "number" ? raw.min : null;
  const max = typeof raw.max === "number" ? raw.max : null;
  const step = typeof raw.step === "number" ? raw.step : undefined;
  if (min != null && max != null) {
    return { min, max, step };
  }
  return null;
}

export function primitiveForQuestion(d: QuestionDefinition): z.ZodTypeAny {
  switch (d.input_type) {
    case "boolean":
      /** HTML forms sometimes emit boolean-ish strings — keep strict-ish but resilient. */
      return z.boolean();
    case "number":
    case "scale": {
      const bounds =
        numericBounds(d) ??
        (d.input_type === "scale" ? ({ min: 0, max: 10 } as const) : ({ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY } as const));
      return z.coerce.number().min(bounds.min).max(bounds.max);
    }
    case "multiselect":
      return z.array(z.string()).default([]);
    case "select":
      return z.string();
    case "text":
      return z.string();
    default:
      return z.unknown();
  }
}

/** Draft submissions allow partial answers; finalize enforces {@link QuestionDefinition.is_required}. */
export function buildSectionAnswersSchema(defs: QuestionDefinition[], finalize: boolean) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const d of defs) {
    let base = primitiveForQuestion(d);
    if (!finalize) {
      base = base.optional().nullable();
      shape[d.question_key] = base;
      continue;
    }
    if (!d.is_required) {
      base = base.optional().nullable();
    }
    shape[d.question_key] = base;
  }

  const object = z.object(shape).superRefine((values, ctx) => {
    if (!finalize) return;
    for (const d of defs.filter((item) => item.is_required)) {
      const raw = (values as Record<string, unknown>)[d.question_key];
      const empty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (typeof raw === "string" && raw.trim().length === 0) ||
        (Array.isArray(raw) && raw.length === 0);
      if (empty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Required",
          path: [d.question_key],
        });
      }
    }
  });

  return object;
}
