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
 * Normalizes to strict `HH:MM` for JSON storage and validation.
 */
export function normalizeTimeToHHmm(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const withSeconds = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (withSeconds) {
    const h = Math.min(23, Math.max(0, parseInt(withSeconds[1], 10)));
    const m = Math.min(59, Math.max(0, parseInt(withSeconds[2], 10)));
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return s;
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
