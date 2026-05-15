import type { QuestionDefinition } from "./types";

/**
 * Merges platform defaults (`outlet_id = null`) with outlet overrides.
 * Outlet rows win when `question_key` collides — enables white-label questionnaires without duplication.
 */
export function mergeOutletQuestionDefinitions(rows: QuestionDefinition[]): QuestionDefinition[] {
  const byKey = new Map<string, QuestionDefinition>();
  const platformRows: QuestionDefinition[] = [];
  const outletRows: QuestionDefinition[] = [];

  for (const row of rows) {
    if (row.outlet_id == null) platformRows.push(row);
    else outletRows.push(row);
  }

  for (const row of platformRows) {
    byKey.set(row.question_key, row);
  }
  for (const row of outletRows) {
    byKey.set(row.question_key, row);
  }

  return [...byKey.values()].sort((a, b) => a.display_order - b.display_order);
}
