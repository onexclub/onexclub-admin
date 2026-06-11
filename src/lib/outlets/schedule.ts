/**
 * Outlet operating schedule — **canonical store:** relational `outlet_hours` + `outlet_hour_exceptions`
 * (migration `019_outlet_hours_tables.sql`). JSON shape below remains the **UI DTO** for forms and summaries.
 *
 * **Reuse:** Import parsers/serializers from any Server Action or customer-facing API that
 * needs consistent weekly hours + one-off / recurring closure messaging.
 *
 * **India-only console:** Gym admin saves omit `timezone`; treat all times as local / IST in product copy.
 *
 * Legacy rows may use `{ mon: "06:00-22:00" }` — `parseOutletOpeningHours` normalizes both shapes.
 *
 * **Split shifts:** `shift2_open` / `shift2_close` = evening block (same calendar day).
 * **24h:** `is_24_hours` — do not send open/close for that day.
 *
 * **Saving hours:** Browsers often post `<input type="time">` as `HH:MM:SS` — use `normalizeTimeToHHmm` before validation.
 */

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type DayHours = {
  closed?: boolean;
  /** Open 24h (midnight–midnight); mutually exclusive with `closed` and timed shifts. */
  is_24_hours?: boolean;
  open?: string;
  close?: string;
  /** Second block same day (e.g. morning + evening); requires shift 1 open/close. */
  shift2_open?: string;
  shift2_close?: string;
};

export type OutletClosureEntry = {
  /** ISO date `YYYY-MM-DD` for a one-off closure/holiday. */
  date?: string;
  /** Recurring weekly off (e.g. every Sunday) when `date` is omitted. */
  weekday?: WeekdayKey;
  label?: string;
  all_day?: boolean;
  open?: string;
  close?: string;
};

export type OutletOpeningHoursJson = {
  timezone?: string;
  weekly?: Partial<Record<WeekdayKey, DayHours>>;
  closures?: OutletClosureEntry[];
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeHHmm(value: string): boolean {
  return TIME_RE.test(value.trim());
}

/**
 * HTML `<input type="time">` often submits `HH:MM:SS`; some browsers use `H:M`.
 * Postgres / Supabase may return `HH:MM:SS`, fractional seconds, or ISO timestamps.
 * Normalizes to strict `HH:MM` for JSON storage, validation, and time inputs.
 */
export function normalizeTimeToHHmm(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  // ISO datetime (Supabase occasionally serializes TIME this way)
  const isoMatch = s.match(/T(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
  if (isoMatch) {
    const h = Math.min(23, Math.max(0, parseInt(isoMatch[1]!, 10)));
    const m = Math.min(59, Math.max(0, parseInt(isoMatch[2]!, 10)));
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // HH:MM[:SS[.fraction]][+offset|Z] — offset may be +00, +0530, +05:30
  const timeMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if (timeMatch) {
    const h = Math.min(23, Math.max(0, parseInt(timeMatch[1]!, 10)));
    const m = Math.min(59, Math.max(0, parseInt(timeMatch[2]!, 10)));
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return s;
}

/** Safe value for `<input type="time">` — blank when not a valid HH:MM. */
export function toTimeInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const normalized = normalizeTimeToHHmm(raw);
  return isValidTimeHHmm(normalized) ? normalized : "";
}

export type Time12hParts = {
  hour12: string;
  minute: string;
  period: "AM" | "PM";
};

/** Split 24h `HH:MM` into 12-hour picker parts (India-friendly UI). */
export function parseHHmmTo12h(hhmm: string): Time12hParts | null {
  const normalized = normalizeTimeToHHmm(hhmm);
  if (!isValidTimeHHmm(normalized)) return null;
  const [hStr, mStr] = normalized.split(":");
  const h24 = parseInt(hStr!, 10);
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12: String(hour12), minute: mStr!, period };
}

/** Combine 12-hour picker parts → 24h `HH:MM` for storage. */
export function format12hPartsToHHmm(hour12: number, minute: number, period: "AM" | "PM"): string {
  const h = Math.min(12, Math.max(1, Math.floor(hour12)));
  const m = Math.min(59, Math.max(0, Math.floor(minute)));
  let h24: number;
  if (period === "AM") {
    h24 = h === 12 ? 0 : h;
  } else {
    h24 = h === 12 ? 12 : h + 12;
  }
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Human label e.g. `6:00 AM` — used beside schedule pickers. */
export function formatHHmmForDisplay(hhmm: string): string {
  const parts = parseHHmmTo12h(hhmm);
  if (!parts) return "—";
  return `${parts.hour12}:${parts.minute} ${parts.period}`;
}

/** One-click shift preset for the weekly hours editor. Times are 24h `HH:MM`. */
export type ScheduleShiftPreset = {
  label: string;
  open: string;
  close: string;
};

/** Common morning blocks — `WeeklyScheduleEditor` quick picks (Mon–Sat). */
export const MORNING_SHIFT_PRESETS: ScheduleShiftPreset[] = [
  { label: "6 – 11 AM", open: "06:00", close: "11:00" },
  { label: "6 – 10 AM", open: "06:00", close: "10:00" },
  { label: "7 AM – 12 PM", open: "07:00", close: "12:00" },
  { label: "5 – 10 AM", open: "05:00", close: "10:00" },
];

/** Common evening blocks — fills shift 2 (open2 / close2) on Mon–Sat. */
export const EVENING_SHIFT_PRESETS: ScheduleShiftPreset[] = [
  { label: "4 – 10 PM", open: "16:00", close: "22:00" },
  { label: "5 – 9 PM", open: "17:00", close: "21:00" },
  { label: "6 – 10 PM", open: "18:00", close: "22:00" },
  { label: "5 – 11 PM", open: "17:00", close: "23:00" },
];

/** Restrict hour field while typing (12-hour clock: 1–12 only). */
export function sanitizeHour12Input(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  if (digits.length === 1) {
    const n = parseInt(digits, 10);
    if (n === 0) return "";
    return digits;
  }
  const n = parseInt(digits, 10);
  if (n < 1 || n > 12) return digits.slice(0, 1);
  return digits;
}

/** Restrict minute field while typing (0–59). */
export function sanitizeMinuteInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  if (digits.length === 1) return digits;
  const n = parseInt(digits, 10);
  if (n > 59) return digits.slice(0, 1);
  return digits;
}

export function isValidHour12Input(raw: string): boolean {
  if (!raw.trim()) return true;
  const n = parseInt(raw, 10);
  return !Number.isNaN(n) && n >= 1 && n <= 12;
}

export function isValidMinuteInput(raw: string): boolean {
  if (!raw.trim()) return true;
  const n = parseInt(raw, 10);
  return !Number.isNaN(n) && n >= 0 && n <= 59;
}

/** Pad minutes on blur; clamps invalid values. */
export function normalizeMinuteInputOnBlur(raw: string): string {
  if (!raw.trim()) return "";
  const n = Math.min(59, Math.max(0, parseInt(raw, 10) || 0));
  return String(n).padStart(2, "0");
}

/**
 * ISO date, optional `HH:MM–HH:MM` short hours, optional label.
 * Examples: `2026-01-26 Republic Day` | `2026-04-14 07:00-12:00 Baisakhi`
 */
const HOLIDAY_LINE_RE =
  /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2}))?\s*(.*)$/;

export function parseHolidayLines(text: string): OutletClosureEntry[] {
  const out: OutletClosureEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(HOLIDAY_LINE_RE);
    if (!m) continue;
    const date = m[1];
    const open = m[2]?.trim();
    const close = m[3]?.trim();
    const rest = (m[4] ?? "").trim();
    if (open && close) {
      out.push({
        date,
        open: normalizeTimeToHHmm(open),
        close: normalizeTimeToHHmm(close),
        ...(rest ? { label: rest } : {}),
        all_day: false,
      });
      continue;
    }
    out.push({ date, ...(rest ? { label: rest } : {}), all_day: true });
  }
  return out;
}

/** Textarea prefill for dated closures (weekday-only rows stay in `preserved_weekday_closures` hidden JSON). */
export function formatHolidayLinesForTextarea(closures: OutletClosureEntry[] | undefined): string {
  if (!closures?.length) return "";
  return closures
    .filter((c) => c.date)
    .map((c) => {
      const d = c.date!;
      if (c.open && c.close && c.all_day === false) {
        const label = c.label?.trim();
        return label ? `${d} ${c.open}-${c.close} ${label}` : `${d} ${c.open}-${c.close}`;
      }
      return c.label?.trim() ? `${d} ${c.label.trim()}` : d;
    })
    .join("\n");
}

function parseLegacyRange(value: string): DayHours | null {
  const m = value.trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!m) return null;
  return { open: m[1], close: m[2] };
}

/** Normalizes DB JSON into a predictable structure for forms + member apps. */
export function parseOutletOpeningHours(raw: unknown): OutletOpeningHoursJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { weekly: defaultWeeklyHours(), closures: [] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.weekly && typeof obj.weekly === "object" && !Array.isArray(obj.weekly)) {
    const weekly = obj.weekly as Partial<Record<WeekdayKey, DayHours>>;
    const closures = Array.isArray(obj.closures) ? (obj.closures as OutletClosureEntry[]) : [];
    return {
      timezone: typeof obj.timezone === "string" ? obj.timezone : undefined,
      weekly: { ...defaultWeeklyHours(), ...weekly },
      closures,
    };
  }

  const weekly: Partial<Record<WeekdayKey, DayHours>> = { ...defaultWeeklyHours() };
  for (const key of WEEKDAY_KEYS) {
    const v = obj[key];
    if (typeof v === "string") {
      const parsed = parseLegacyRange(v);
      if (parsed) weekly[key] = parsed;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      weekly[key] = v as DayHours;
    }
  }

  const closures = Array.isArray(obj.closures) ? (obj.closures as OutletClosureEntry[]) : [];
  return { timezone: typeof obj.timezone === "string" ? obj.timezone : undefined, weekly, closures };
}

export function defaultWeeklyHours(): Partial<Record<WeekdayKey, DayHours>> {
  return {
    mon: { open: "06:00", close: "22:00" },
    tue: { open: "06:00", close: "22:00" },
    wed: { open: "06:00", close: "22:00" },
    thu: { open: "06:00", close: "22:00" },
    fri: { open: "06:00", close: "22:00" },
    sat: { open: "07:00", close: "20:00" },
    sun: { closed: true },
  };
}

/** Display values when a day is marked 24h (shown read-only in the editor). */
export const HOURS_24_OPEN = "00:00";
export const HOURS_24_CLOSE = "23:59";

/** One row in the controlled weekly schedule editor (`WeeklyScheduleEditor`). */
export type DayScheduleRow = {
  closed: boolean;
  is24h: boolean;
  open: string;
  close: string;
  open2: string;
  close2: string;
};

export function emptyDayRow(): DayScheduleRow {
  return { closed: false, is24h: false, open: "", close: "", open2: "", close2: "" };
}

export function hasAnyConfiguredDay(weekly: Partial<Record<WeekdayKey, DayHours>> | undefined): boolean {
  if (!weekly) return false;
  return WEEKDAY_KEYS.some((k) => {
    const d = weekly[k];
    if (!d) return false;
    if (d.closed || d.is_24_hours) return true;
    return Boolean(d.open && d.close);
  });
}

/** Editor prefill: saved weekly, or gym defaults when nothing saved yet. */
export function prefillWeeklyForEditor(
  weekly: Partial<Record<WeekdayKey, DayHours>> | undefined,
  useDefaultsWhenEmpty: boolean,
): Partial<Record<WeekdayKey, DayHours>> {
  if (useDefaultsWhenEmpty && !hasAnyConfiguredDay(weekly)) {
    return { ...defaultWeeklyHours() };
  }
  return weekly ?? {};
}

export function dayHoursToRow(day: DayHours | undefined): DayScheduleRow {
  if (!day) return emptyDayRow();
  if (day.closed) return { ...emptyDayRow(), closed: true };
  if (day.is_24_hours) {
    return {
      closed: false,
      is24h: true,
      open: HOURS_24_OPEN,
      close: HOURS_24_CLOSE,
      open2: "",
      close2: "",
    };
  }
  return {
    closed: false,
    is24h: false,
    open: toTimeInputValue(day.open),
    close: toTimeInputValue(day.close),
    open2: toTimeInputValue(day.shift2_open),
    close2: toTimeInputValue(day.shift2_close),
  };
}

export function weeklyToEditorRows(weekly: Partial<Record<WeekdayKey, DayHours>> | undefined): Record<WeekdayKey, DayScheduleRow> {
  const out = {} as Record<WeekdayKey, DayScheduleRow>;
  for (const key of WEEKDAY_KEYS) {
    out[key] = dayHoursToRow(weekly?.[key]);
  }
  return out;
}

export function rowToDayHours(row: DayScheduleRow): DayHours | null {
  if (row.closed) return { closed: true };
  if (row.is24h) return { is_24_hours: true };
  const open = normalizeTimeToHHmm(row.open);
  const close = normalizeTimeToHHmm(row.close);
  if (!open || !close || !isValidTimeHHmm(open) || !isValidTimeHHmm(close)) return null;
  const day: DayHours = { open, close };
  const o2 = normalizeTimeToHHmm(row.open2);
  const c2 = normalizeTimeToHHmm(row.close2);
  if (o2 && c2 && isValidTimeHHmm(o2) && isValidTimeHHmm(c2)) {
    day.shift2_open = o2;
    day.shift2_close = c2;
  }
  return day;
}

export function editorRowsToWeekly(rows: Record<WeekdayKey, DayScheduleRow>): Partial<Record<WeekdayKey, DayHours>> {
  const weekly: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const key of WEEKDAY_KEYS) {
    const day = rowToDayHours(rows[key]);
    if (day) weekly[key] = day;
  }
  return weekly;
}

export type SundayCopyMode = "same" | "closed" | "morning-only";

/** Copy Monday's row to other weekdays (typical gym routine). */
export function copyMondayToDays(
  rows: Record<WeekdayKey, DayScheduleRow>,
  targetDays: WeekdayKey[],
  sundayMode?: SundayCopyMode,
): Record<WeekdayKey, DayScheduleRow> {
  const mon = rows.mon;
  const next = { ...rows };
  for (const key of targetDays) {
    if (key === "sun" && sundayMode) {
      if (sundayMode === "closed") {
        next.sun = { ...emptyDayRow(), closed: true };
      } else if (sundayMode === "morning-only") {
        next.sun = {
          closed: false,
          is24h: mon.is24h,
          open: mon.is24h ? HOURS_24_OPEN : mon.open,
          close: mon.is24h ? HOURS_24_CLOSE : mon.close,
          open2: "",
          close2: "",
        };
      } else {
        next.sun = { ...mon };
      }
      continue;
    }
    next[key] = { ...mon };
  }
  return next;
}

/** JSON payload from `WeeklyScheduleEditor` → server action (reliable save vs many native inputs). */
export type ScheduleFormPayload = {
  weekly: Partial<Record<WeekdayKey, DayHours>>;
  holidays_lines?: string;
  preserved_weekday_closures?: OutletClosureEntry[];
};

export function buildScheduleFormPayload(args: {
  rows: Record<WeekdayKey, DayScheduleRow>;
  holidaysText: string;
  preservedWeekdayClosures: OutletClosureEntry[];
}): ScheduleFormPayload {
  return {
    weekly: editorRowsToWeekly(args.rows),
    holidays_lines: args.holidaysText,
    preserved_weekday_closures: args.preservedWeekdayClosures,
  };
}

function timeOrderOk(open: string, close: string): boolean {
  return open < close;
}

/** Validates weekly map before DB write — shared by JSON + legacy FormData parsers. */
export function validateWeeklySchedule(
  weekly: Partial<Record<WeekdayKey, DayHours>>,
): { ok: true; weekly: Partial<Record<WeekdayKey, DayHours>> } | { ok: false; error: string } {
  const out: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const day of WEEKDAY_KEYS) {
    const d = weekly[day];
    if (!d) continue;

    if (d.closed && d.is_24_hours) {
      return { ok: false, error: `${WEEKDAY_LABELS[day]}: choose either closed or 24 hours, not both.` };
    }
    if (d.closed) {
      out[day] = { closed: true };
      continue;
    }
    if (d.is_24_hours) {
      out[day] = { is_24_hours: true };
      continue;
    }

    const open = normalizeTimeToHHmm(d.open ?? "");
    const close = normalizeTimeToHHmm(d.close ?? "");
    const open2 = normalizeTimeToHHmm(d.shift2_open ?? "");
    const close2 = normalizeTimeToHHmm(d.shift2_close ?? "");

    if (open && !isValidTimeHHmm(open)) {
      return { ok: false, error: `${WEEKDAY_LABELS[day]}: open time must be valid (24-hour).` };
    }
    if (close && !isValidTimeHHmm(close)) {
      return { ok: false, error: `${WEEKDAY_LABELS[day]}: close time must be valid (24-hour).` };
    }
    if (open2 && !isValidTimeHHmm(open2)) {
      return { ok: false, error: `${WEEKDAY_LABELS[day]}: evening open time must be valid (24-hour).` };
    }
    if (close2 && !isValidTimeHHmm(close2)) {
      return { ok: false, error: `${WEEKDAY_LABELS[day]}: evening close time must be valid (24-hour).` };
    }

    if (open && close) {
      if (!timeOrderOk(open, close)) {
        return { ok: false, error: `${WEEKDAY_LABELS[day]}: close time must be after open time.` };
      }
      const row: DayHours = { open, close };
      if (open2 || close2) {
        if (!open2 || !close2) {
          return { ok: false, error: `${WEEKDAY_LABELS[day]}: evening shift needs both open and close.` };
        }
        if (!timeOrderOk(open2, close2)) {
          return { ok: false, error: `${WEEKDAY_LABELS[day]}: evening close must be after evening open.` };
        }
        row.shift2_open = open2;
        row.shift2_close = close2;
      }
      out[day] = row;
      continue;
    }

    if (open2 || close2) {
      return { ok: false, error: `${WEEKDAY_LABELS[day]}: set morning hours before adding an evening shift.` };
    }
  }

  return { ok: true, weekly: out };
}

export function serializeOutletOpeningHours(model: OutletOpeningHoursJson): OutletOpeningHoursJson {
  const weekly: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const key of WEEKDAY_KEYS) {
    const day = model.weekly?.[key] ?? defaultWeeklyHours()[key];
    if (!day) continue;
    if (day.closed) {
      weekly[key] = { closed: true };
      continue;
    }
    if (day.is_24_hours) {
      weekly[key] = { is_24_hours: true };
      continue;
    }
    const openRaw = day.open?.trim() ?? "";
    const closeRaw = day.close?.trim() ?? "";
    const open = openRaw ? normalizeTimeToHHmm(openRaw) : "";
    const close = closeRaw ? normalizeTimeToHHmm(closeRaw) : "";
    const s2o = day.shift2_open?.trim() ? normalizeTimeToHHmm(day.shift2_open.trim()) : "";
    const s2c = day.shift2_close?.trim() ? normalizeTimeToHHmm(day.shift2_close.trim()) : "";
    if (open && close && isValidTimeHHmm(open) && isValidTimeHHmm(close)) {
      const row: DayHours = { open, close };
      if (
        s2o &&
        s2c &&
        isValidTimeHHmm(s2o) &&
        isValidTimeHHmm(s2c)
      ) {
        row.shift2_open = s2o;
        row.shift2_close = s2c;
      }
      weekly[key] = row;
    }
  }

  const closures = (model.closures ?? [])
    .map((c) => {
      const o = c.open?.trim() ? normalizeTimeToHHmm(c.open.trim()) : "";
      const cl = c.close?.trim() ? normalizeTimeToHHmm(c.close.trim()) : "";
      return {
        ...(c.date?.trim() ? { date: c.date.trim() } : {}),
        ...(c.weekday && WEEKDAY_KEYS.includes(c.weekday) ? { weekday: c.weekday } : {}),
        ...(c.label?.trim() ? { label: c.label.trim() } : {}),
        ...(c.all_day ? { all_day: true } : {}),
        ...(o && isValidTimeHHmm(o) ? { open: o } : {}),
        ...(cl && isValidTimeHHmm(cl) ? { close: cl } : {}),
      };
    })
    .filter((c) => c.date || c.weekday);

  return {
    ...(model.timezone?.trim() ? { timezone: model.timezone.trim() } : {}),
    weekly,
    closures,
  };
}

/** Merge dated holidays from the textarea with weekday-only rows we keep for backwards compatibility. */
export function mergeOutletClosures(
  datedFromTextarea: OutletClosureEntry[],
  weekdayOnlyPreserved: OutletClosureEntry[],
): OutletClosureEntry[] {
  const dated = datedFromTextarea.filter((c) => c.date);
  const wk = weekdayOnlyPreserved.filter((c) => c.weekday && WEEKDAY_KEYS.includes(c.weekday));
  return [...dated, ...wk];
}

/** Human summary for admin tables (e.g. "Mon–Fri 06:00–22:00 · Sun closed"). */
export function formatWeeklyHoursSummary(model: OutletOpeningHoursJson): string {
  const weekly = model.weekly ?? defaultWeeklyHours();
  const openDays = WEEKDAY_KEYS.filter((k) => {
    const d = weekly[k];
    if (!d || d.closed) return false;
    if (d.is_24_hours) return true;
    return Boolean(d.open && d.close);
  });
  if (!openDays.length) return "No open days configured";
  const first = weekly[openDays[0]!];
  const sameHours = openDays.every((k) => {
    const d = weekly[k];
    return (
      d?.is_24_hours === first?.is_24_hours &&
      d?.open === first?.open &&
      d?.close === first?.close &&
      d?.shift2_open === first?.shift2_open &&
      d?.shift2_close === first?.shift2_close
    );
  });
  if (sameHours && openDays.length >= 5) {
    const closed = WEEKDAY_KEYS.filter((k) => weekly[k]?.closed).map((k) => WEEKDAY_LABELS[k].slice(0, 3));
    const range =
      openDays.length === 7
        ? "Daily"
        : `${WEEKDAY_LABELS[openDays[0]!].slice(0, 3)}–${WEEKDAY_LABELS[openDays[openDays.length - 1]!].slice(0, 3)}`;
    const block =
      first?.is_24_hours
        ? "24h"
        : [
            `${first?.open}–${first?.close}`,
            first?.shift2_open && first?.shift2_close ? `${first.shift2_open}–${first.shift2_close}` : null,
          ]
            .filter(Boolean)
            .join(", ");
    return `${range} ${block}${closed.length ? ` · ${closed.join(", ")} closed` : ""}`;
  }
  return openDays
    .map((k) => {
      const d = weekly[k];
      if (d?.is_24_hours) return `${WEEKDAY_LABELS[k].slice(0, 3)} 24h`;
      const a = `${d?.open}–${d?.close}`;
      const b =
        d?.shift2_open && d?.shift2_close ? ` & ${d.shift2_open}–${d.shift2_close}` : "";
      return `${WEEKDAY_LABELS[k].slice(0, 3)} ${a}${b}`;
    })
    .join(" · ");
}

/** Stable JSON key for comparing weekly hours across branches (global vs per-branch UI). */
export function serializeWeeklyForCompare(weekly: Partial<Record<WeekdayKey, DayHours>> | undefined): string {
  const normalized = serializeOutletOpeningHours({ weekly: weekly ?? {}, closures: [] }).weekly ?? {};
  const ordered: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const key of WEEKDAY_KEYS) {
    if (normalized[key]) ordered[key] = normalized[key];
  }
  return JSON.stringify(ordered);
}

/** True when every outlet shares the same weekly timetable. */
export function outletsShareWeeklySchedule(outlets: { opening_hours: OutletOpeningHoursJson }[]): boolean {
  if (outlets.length <= 1) return true;
  const first = serializeWeeklyForCompare(outlets[0]?.opening_hours.weekly);
  return outlets.every((o) => serializeWeeklyForCompare(o.opening_hours.weekly) === first);
}

/** Prefill for the “all branches” form — first outlet’s weekly when all match, else empty. */
export function pickCommonWeeklySchedule(
  outlets: { opening_hours: OutletOpeningHoursJson }[],
): Partial<Record<WeekdayKey, DayHours>> {
  if (!outlets.length) return {};
  if (!outletsShareWeeklySchedule(outlets)) return {};
  return outlets[0]!.opening_hours.weekly ?? {};
}

/** Dated holiday lines shared across branches (for global form prefill). */
export function pickCommonDatedClosures(outlets: { opening_hours: OutletOpeningHoursJson }[]): OutletClosureEntry[] {
  if (!outlets.length) return [];
  const dated = (outlets[0]!.opening_hours.closures ?? []).filter((c) => c.date);
  if (!dated.length) return [];
  const key = (list: OutletClosureEntry[]) =>
    JSON.stringify(
      list
        .filter((c) => c.date)
        .map((c) => ({
          date: c.date,
          open: c.open,
          close: c.close,
          label: c.label,
          all_day: c.all_day,
        })),
    );
  const firstKey = key(dated);
  const allMatch = outlets.every((o) => key(o.opening_hours.closures ?? []) === firstKey);
  return allMatch ? dated : [];
}

/** React `key` for schedule forms — remount when server data changes after save/refresh. */
export function buildScheduleFormKey(
  scopeId: string,
  weekly: Partial<Record<WeekdayKey, DayHours>> | undefined,
  holidaysText = "",
): string {
  return `${scopeId}:${serializeWeeklyForCompare(weekly)}:${holidaysText}`;
}

export function formatClosurePreview(entry: OutletClosureEntry): string {
  if (entry.date) {
    if (entry.open && entry.close && entry.all_day === false) {
      return `${entry.date} ${entry.open}–${entry.close}${entry.label ? ` — ${entry.label}` : ""}`;
    }
    return `${entry.date}${entry.label ? ` — ${entry.label}` : ""}${entry.all_day !== false ? " (closed)" : ""}`;
  }
  if (entry.weekday) {
    return `Every ${WEEKDAY_LABELS[entry.weekday]}${entry.label ? ` — ${entry.label}` : ""}`;
  }
  return "Closure";
}
