"use client";

/**
 * Controlled weekly hours editor — submits `schedule_json` (see `ScheduleFormPayload`).
 *
 * **Reuse:** Primary branch schedule + per-branch overrides in `GymSettingsPanels`.
 * **Why JSON:** Controlled state + one hidden JSON field — reliable save via Server Actions.
 */

import { useMemo, useState } from "react";
import { ScheduleTimeInput } from "@/components/admin/ScheduleTimeInput";
import {
  buildScheduleFormPayload,
  copyMondayToDays,
  EVENING_SHIFT_PRESETS,
  formatClosurePreview,
  HOURS_24_CLOSE,
  HOURS_24_OPEN,
  MORNING_SHIFT_PRESETS,
  normalizeTimeToHHmm,
  prefillWeeklyForEditor,
  weeklyToEditorRows,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  type DayScheduleRow,
  type OutletClosureEntry,
  type ScheduleShiftPreset,
  type WeekdayKey,
} from "@/lib/outlets/schedule";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const WEEKDAY_TARGETS = ["tue", "wed", "thu", "fri", "sat"] as const satisfies readonly WeekdayKey[];
const QUICK_APPLY_DAYS: WeekdayKey[] = ["mon", ...WEEKDAY_TARGETS];

const presetBtnClass =
  "inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-800 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-orange-500/50 dark:hover:bg-orange-950/30 dark:hover:text-orange-200";

function cloneRows(rows: Record<WeekdayKey, DayScheduleRow>): Record<WeekdayKey, DayScheduleRow> {
  const next = {} as Record<WeekdayKey, DayScheduleRow>;
  for (const key of WEEKDAY_KEYS) {
    next[key] = { ...rows[key] };
  }
  return next;
}

function patchRow(
  rows: Record<WeekdayKey, DayScheduleRow>,
  day: WeekdayKey,
  patch: Partial<DayScheduleRow>,
): Record<WeekdayKey, DayScheduleRow> {
  const next = cloneRows(rows);
  const current = next[day];
  const merged = { ...current, ...patch };

  if (patch.closed) {
    next[day] = { ...emptyRow(), closed: true };
    return next;
  }
  if (patch.is24h) {
    next[day] = {
      closed: false,
      is24h: true,
      open: HOURS_24_OPEN,
      close: HOURS_24_CLOSE,
      open2: "",
      close2: "",
    };
    return next;
  }
  if (patch.is24h === false) {
    next[day] = { closed: false, is24h: false, open: "", close: "", open2: "", close2: "" };
    return next;
  }

  next[day] = merged;
  return next;
}

function emptyRow(): DayScheduleRow {
  return { closed: false, is24h: false, open: "", close: "", open2: "", close2: "" };
}

function setTime(
  rows: Record<WeekdayKey, DayScheduleRow>,
  day: WeekdayKey,
  field: keyof Pick<DayScheduleRow, "open" | "close" | "open2" | "close2">,
  raw: string,
): Record<WeekdayKey, DayScheduleRow> {
  const value = normalizeTimeToHHmm(raw);
  return patchRow(rows, day, { [field]: value, closed: false, is24h: false } as Partial<DayScheduleRow>);
}

function applyMorningPreset(
  rows: Record<WeekdayKey, DayScheduleRow>,
  preset: ScheduleShiftPreset,
  days: WeekdayKey[],
): Record<WeekdayKey, DayScheduleRow> {
  let next = rows;
  for (const day of days) {
    next = patchRow(next, day, {
      closed: false,
      is24h: false,
      open: preset.open,
      close: preset.close,
    });
  }
  return next;
}

function applyEveningPreset(
  rows: Record<WeekdayKey, DayScheduleRow>,
  preset: ScheduleShiftPreset,
  days: WeekdayKey[],
): Record<WeekdayKey, DayScheduleRow> {
  let next = rows;
  for (const day of days) {
    const current = next[day];
    if (current.closed || current.is24h) continue;
    next = patchRow(next, day, {
      open2: preset.open,
      close2: preset.close,
    });
  }
  return next;
}

export function WeeklyScheduleEditor({
  initialWeekly,
  initialHolidaysText,
  preservedWeekdayClosures,
  formKey,
  useDefaultsWhenEmpty = false,
  showCopyMondayTools = true,
}: {
  initialWeekly: Parameters<typeof prefillWeeklyForEditor>[0];
  initialHolidaysText: string;
  preservedWeekdayClosures: OutletClosureEntry[];
  formKey: string;
  useDefaultsWhenEmpty?: boolean;
  showCopyMondayTools?: boolean;
}) {
  const prefill = prefillWeeklyForEditor(initialWeekly, useDefaultsWhenEmpty);
  const [rows, setRows] = useState(() => weeklyToEditorRows(prefill));
  const [holidaysText, setHolidaysText] = useState(initialHolidaysText);
  const [sundayMode, setSundayMode] = useState<"same" | "closed" | "morning-only">("closed");

  const scheduleJson = useMemo(
    () =>
      JSON.stringify(
        buildScheduleFormPayload({
          rows,
          holidaysText,
          preservedWeekdayClosures,
        }),
      ),
    [rows, holidaysText, preservedWeekdayClosures],
  );

  const monHasHours = Boolean(rows.mon.closed || rows.mon.is24h || (rows.mon.open && rows.mon.close));

  return (
    <div className="space-y-4">
      <input type="hidden" name="schedule_json" value={scheduleJson} readOnly />

      {showCopyMondayTools ? (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Quick morning hours (Mon–Sat)</p>
            <div className="flex flex-wrap gap-2">
              {MORNING_SHIFT_PRESETS.map((preset) => (
                <button
                  key={`morning-${preset.label}`}
                  type="button"
                  onClick={() => setRows((prev) => applyMorningPreset(prev, preset, QUICK_APPLY_DAYS))}
                  className={presetBtnClass}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Quick evening session (Mon–Sat)</p>
            <div className="flex flex-wrap gap-2">
              {EVENING_SHIFT_PRESETS.map((preset) => (
                <button
                  key={`evening-${preset.label}`}
                  type="button"
                  onClick={() => setRows((prev) => applyEveningPreset(prev, preset, QUICK_APPLY_DAYS))}
                  className={presetBtnClass}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Most gyms share the same hours Mon–Sat. Use a quick preset above, fine-tune in the table (hour 1–12, then
            AM/PM), or set <span className="font-medium">Monday</span> and copy below.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!monHasHours}
              onClick={() => setRows((prev) => copyMondayToDays(prev, [...WEEKDAY_TARGETS]))}
              className="inline-flex h-8 items-center rounded-md border border-orange-500/40 px-3 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50 dark:text-orange-300 dark:hover:bg-orange-950/30"
            >
              Copy Monday → Tue–Sat
            </button>
            <button
              type="button"
              disabled={!monHasHours}
              onClick={() =>
                setRows((prev) => copyMondayToDays(prev, ["tue", "wed", "thu", "fri", "sat", "sun"], sundayMode))
              }
              className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Copy Monday → all days
            </button>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              Sunday when copying all:
              <select
                value={sundayMode}
                onChange={(e) => setSundayMode(e.target.value as typeof sundayMode)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="closed">Closed</option>
                <option value="morning-only">Morning only (Mon shift 1)</option>
                <option value="same">Same as Monday</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/80">
        <table className="min-w-[880px] w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Day</th>
              <th className="px-3 py-2 font-semibold">Closed</th>
              <th className="px-3 py-2 font-semibold">24h</th>
              <th className="px-3 py-2 font-semibold">Morning opens</th>
              <th className="px-3 py-2 font-semibold">Morning closes</th>
              <th className="px-3 py-2 font-semibold">Evening opens</th>
              <th className="px-3 py-2 font-semibold">Evening closes</th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAY_KEYS.map((day) => {
              const row = rows[day];
              const timesDisabled = row.closed || row.is24h;
              return (
                <tr
                  key={`${formKey}-${day}`}
                  className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${day === "sun" ? "bg-zinc-50/80 dark:bg-zinc-900/40" : ""}`}
                >
                  <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                    {WEEKDAY_LABELS[day]}
                    {day === "sun" ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">Often closed / morning</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => setRows((prev) => patchRow(prev, day, { closed: e.target.checked }))}
                      className="size-4 rounded border-zinc-400 text-orange-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.is24h}
                      onChange={(e) => setRows((prev) => patchRow(prev, day, { is24h: e.target.checked }))}
                      disabled={row.closed}
                      className="size-4 rounded border-zinc-400 text-orange-600 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {row.is24h ? (
                      <span className="text-xs text-zinc-500">—</span>
                    ) : (
                      <ScheduleTimeInput
                        aria-label={`${WEEKDAY_LABELS[day]} morning opens`}
                        value={row.open}
                        disabled={timesDisabled}
                        onChange={(open) => setRows((prev) => setTime(prev, day, "open", open))}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.is24h ? (
                      <span className="text-xs text-zinc-500">—</span>
                    ) : (
                      <ScheduleTimeInput
                        aria-label={`${WEEKDAY_LABELS[day]} morning closes`}
                        value={row.close}
                        disabled={timesDisabled}
                        onChange={(close) => setRows((prev) => setTime(prev, day, "close", close))}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ScheduleTimeInput
                      aria-label={`${WEEKDAY_LABELS[day]} evening opens`}
                      value={row.open2}
                      disabled={timesDisabled || row.is24h}
                      onChange={(open2) =>
                        setRows((prev) => patchRow(prev, day, { open2: normalizeTimeToHHmm(open2) }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ScheduleTimeInput
                      aria-label={`${WEEKDAY_LABELS[day]} evening closes`}
                      value={row.close2}
                      disabled={timesDisabled || row.is24h}
                      onChange={(close2) =>
                        setRows((prev) => patchRow(prev, day, { close2: normalizeTimeToHHmm(close2) }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Holidays &amp; one-off closures</span>
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Full-day: <span className="font-mono">YYYY-MM-DD</span> name. Short hours:{" "}
            <span className="font-mono">YYYY-MM-DD HH:MM–HH:MM</span> name.
          </span>
          <textarea
            name="holidays_lines_display"
            rows={4}
            value={holidaysText}
            onChange={(e) => setHolidaysText(e.target.value)}
            placeholder={"2026-01-26 Republic Day\n2026-03-14 Holi"}
            className={`${inputClass} mt-2 min-h-[100px] resize-y font-mono text-xs`}
            spellCheck={false}
          />
        </label>
        {preservedWeekdayClosures.length > 0 ? (
          <p className="text-xs text-amber-800 dark:text-amber-200/90">
            Legacy weekday closures kept:{" "}
            {preservedWeekdayClosures.map((c) => formatClosurePreview(c)).join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
