import type { QuestionDefinition } from "./types";

/** Human-readable value for review rows / summaries — mirrors select/multiselect labels from DB. */
export function formatAnswerPreview(def: QuestionDefinition, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (def.input_type === "boolean") return value ? "Yes" : "No";
  if (def.input_type === "multiselect" && Array.isArray(value)) {
    if (!value.length) return "—";
    return value
      .map((v) => def.options_json?.find((o) => o.value === v)?.label ?? String(v))
      .join(", ");
  }
  if (def.input_type === "select" && def.options_json) {
    const hit = def.options_json.find((o) => o.value === value);
    return hit?.label ?? String(value);
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  const s = String(value).trim();
  return s.length ? s : "—";
}
