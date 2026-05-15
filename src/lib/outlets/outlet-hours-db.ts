/**
 * Maps between `outlet_hours` / `outlet_hour_exceptions` (Postgres) and {@link OutletOpeningHoursJson}.
 *
 * **Reuse:** Server loaders + `updateOutletScheduleAction` only. Day-of-week in DB: 0=Sun … 6=Sat
 * (Postgres `EXTRACT(DOW …)`). UI week keys: {@link WEEKDAY_KEYS} starting Monday — see {@link weekdayKeyToDow}.
 *
 * **Moderator note:** If you add a third shift, extend the table + this mapper together.
 */

import type { DayHours, OutletClosureEntry, OutletOpeningHoursJson, WeekdayKey } from "@/lib/outlets/schedule";
import { normalizeTimeToHHmm, WEEKDAY_KEYS } from "@/lib/outlets/schedule";

/** DB `outlet_hours` row shape from Supabase select. */
export type OutletHourRowDb = {
  outlet_id: string;
  day_of_week: number;
  shift_number: number;
  is_closed: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
};

export type OutletHourExceptionRowDb = {
  outlet_id: string;
  exception_date: string;
  shift_number: number;
  is_closed: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string | null;
};

/** Maps UI key (week starts Monday) → Postgres DOW (week starts Sunday). */
export const WEEKDAY_KEY_TO_DOW: Record<WeekdayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DOW_TO_WEEKDAY_KEY: Record<number, WeekdayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export function weekdayKeyToDow(key: WeekdayKey): number {
  return WEEKDAY_KEY_TO_DOW[key];
}

function pgTimeToHHmm(raw: string | null | undefined): string {
  if (!raw) return "";
  return normalizeTimeToHHmm(raw);
}

/** `HH:MM` → `HH:MM:00` for Postgres TIME via PostgREST. */
export function hhmmToPgTime(hhmm: string): string {
  const n = normalizeTimeToHHmm(hhmm.trim());
  if (n.length !== 5) return n;
  return `${n}:00`;
}

/**
 * Groups `outlet_hours` rows into the JSON weekly model (incl. split shifts + 24h).
 */
export function outletHourRowsToWeekly(rows: OutletHourRowDb[]): Partial<Record<WeekdayKey, DayHours>> {
  const byDow = new Map<number, OutletHourRowDb[]>();
  for (const r of rows) {
    const n = r.day_of_week;
    if (n < 0 || n > 6) continue;
    const list = byDow.get(n) ?? [];
    list.push(r);
    byDow.set(n, list);
  }

  const weekly: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const [dow, list] of byDow) {
    const key = DOW_TO_WEEKDAY_KEY[dow];
    if (!key) continue;
    const sorted = [...list].sort((a, b) => a.shift_number - b.shift_number);
    const s1 = sorted.find((x) => x.shift_number === 1);
    if (!s1) continue;

    if (s1.is_closed) {
      weekly[key] = { closed: true };
      continue;
    }
    if (s1.is_24_hours) {
      weekly[key] = { is_24_hours: true };
      continue;
    }

    const day: DayHours = {
      open: pgTimeToHHmm(s1.open_time),
      close: pgTimeToHHmm(s1.close_time),
    };
    const s2 = sorted.find((x) => x.shift_number === 2);
    if (
      s2 &&
      !s2.is_closed &&
      !s2.is_24_hours &&
      s2.open_time &&
      s2.close_time
    ) {
      day.shift2_open = pgTimeToHHmm(s2.open_time);
      day.shift2_close = pgTimeToHHmm(s2.close_time);
    }
    weekly[key] = day;
  }
  return weekly;
}

/**
 * Turns weekly form model into rows for `outlet_hours` bulk insert.
 * Omits days with no usable data (not configured).
 */
export function weeklyScheduleToOutletHourRows(
  outletId: string,
  weekly: Partial<Record<WeekdayKey, DayHours>>,
): Array<{
  outlet_id: string;
  day_of_week: number;
  shift_number: number;
  is_closed: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
}> {
  const out: Array<{
    outlet_id: string;
    day_of_week: number;
    shift_number: number;
    is_closed: boolean;
    is_24_hours: boolean;
    open_time: string | null;
    close_time: string | null;
  }> = [];

  for (const key of WEEKDAY_KEYS) {
    const d: DayHours | undefined = weekly[key];
    if (!d) continue;
    const dow = WEEKDAY_KEY_TO_DOW[key];

    if (d.closed) {
      out.push({
        outlet_id: outletId,
        day_of_week: dow,
        shift_number: 1,
        is_closed: true,
        is_24_hours: false,
        open_time: null,
        close_time: null,
      });
      continue;
    }

    if (d.is_24_hours) {
      out.push({
        outlet_id: outletId,
        day_of_week: dow,
        shift_number: 1,
        is_closed: false,
        is_24_hours: true,
        open_time: null,
        close_time: null,
      });
      continue;
    }

    const o1 = d.open?.trim() ?? "";
    const c1 = d.close?.trim() ?? "";
    if (!o1 || !c1) continue;

    out.push({
      outlet_id: outletId,
      day_of_week: dow,
      shift_number: 1,
      is_closed: false,
      is_24_hours: false,
      open_time: hhmmToPgTime(o1),
      close_time: hhmmToPgTime(c1),
    });

    const o2 = d.shift2_open?.trim() ?? "";
    const c2 = d.shift2_close?.trim() ?? "";
    if (o2 && c2) {
      out.push({
        outlet_id: outletId,
        day_of_week: dow,
        shift_number: 2,
        is_closed: false,
        is_24_hours: false,
        open_time: hhmmToPgTime(o2),
        close_time: hhmmToPgTime(c2),
      });
    }
  }

  return out;
}

/** Dated exceptions → closures list (for textarea + display). */
export function exceptionRowsToClosures(rows: OutletHourExceptionRowDb[]): OutletClosureEntry[] {
  const byDate = new Map<string, OutletHourExceptionRowDb[]>();
  for (const r of rows) {
    const k = r.exception_date;
    if (!k) continue;
    const list = byDate.get(k) ?? [];
    list.push(r);
    byDate.set(k, list);
  }

  const out: OutletClosureEntry[] = [];
  for (const [date, list] of byDate) {
    const sorted = [...list].sort((a, b) => a.shift_number - b.shift_number);
    const first = sorted[0];
    if (!first) continue;

    if (sorted.length === 1 && first.is_closed) {
      out.push({ date, label: first.reason?.trim() || undefined, all_day: true });
      continue;
    }
    if (sorted.length === 1 && first.is_24_hours) {
      out.push({
        date,
        label: first.reason?.trim() || "Open 24 hours",
        all_day: false,
        open: "00:00",
        close: "23:59",
      });
      continue;
    }
    if (
      sorted.length === 1 &&
      !first.is_closed &&
      !first.is_24_hours &&
      first.open_time &&
      first.close_time
    ) {
      out.push({
        date,
        label: first.reason?.trim() || undefined,
        all_day: false,
        open: pgTimeToHHmm(first.open_time),
        close: pgTimeToHHmm(first.close_time),
      });
      continue;
    }

    out.push({
      date,
      label: first.reason?.trim() || "Special hours (see DB)",
      all_day: true,
    });
  }

  return out.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

/** Closures from the admin form → rows for `outlet_hour_exceptions` (replaces all dated rows for outlet). */
export function closureEntriesToExceptionRows(
  outletId: string,
  closures: OutletClosureEntry[],
): Array<{
  outlet_id: string;
  exception_date: string;
  shift_number: number;
  is_closed: boolean;
  is_24_hours: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string | null;
}> {
  const rows: Array<{
    outlet_id: string;
    exception_date: string;
    shift_number: number;
    is_closed: boolean;
    is_24_hours: boolean;
    open_time: string | null;
    close_time: string | null;
    reason: string | null;
  }> = [];

  for (const c of closures) {
    if (!c.date?.trim()) continue;

    const dated = c.date.trim();
    const label = c.label?.trim() || null;

    if (c.all_day !== false && !c.open && !c.close) {
      rows.push({
        outlet_id: outletId,
        exception_date: dated,
        shift_number: 1,
        is_closed: true,
        is_24_hours: false,
        open_time: null,
        close_time: null,
        reason: label,
      });
      continue;
    }

    const o = c.open?.trim() ?? "";
    const cl = c.close?.trim() ?? "";
    if (o && cl) {
      rows.push({
        outlet_id: outletId,
        exception_date: dated,
        shift_number: 1,
        is_closed: false,
        is_24_hours: false,
        open_time: hhmmToPgTime(o),
        close_time: hhmmToPgTime(cl),
        reason: label,
      });
    }
  }

  return rows;
}

export function mergeOutletHoursSources(args: {
  weekly: Partial<Record<WeekdayKey, DayHours>>;
  closures: OutletClosureEntry[];
  timezone?: string;
}): OutletOpeningHoursJson {
  return {
    ...(args.timezone ? { timezone: args.timezone } : {}),
    weekly: args.weekly,
    closures: args.closures,
  };
}
