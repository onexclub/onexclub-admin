"use client";

import { useEffect, useState } from "react";
import {
  format12hPartsToHHmm,
  isValidHour12Input,
  isValidMinuteInput,
  normalizeMinuteInputOnBlur,
  normalizeTimeToHHmm,
  parseHHmmTo12h,
  sanitizeHour12Input,
  sanitizeMinuteInput,
} from "@/lib/outlets/schedule";
import { cn } from "@/lib/utils/cn";

const wrapClass = "inline-flex min-w-[8.5rem] flex-col gap-0.5";

const rowClass =
  "inline-flex items-center gap-0.5 rounded-md border bg-white px-1.5 py-1 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60 dark:bg-zinc-950 dark:disabled:bg-zinc-900";

const numClass =
  "w-8 border-0 bg-transparent p-0 text-center text-sm tabular-nums text-zinc-900 outline-none placeholder:text-zinc-400 disabled:text-zinc-500 dark:text-zinc-100";

const periodClass =
  "min-w-[3.25rem] border-0 border-l border-zinc-200 bg-transparent py-0 pl-1.5 text-sm font-medium text-zinc-700 outline-none disabled:text-zinc-500 dark:border-zinc-700 dark:text-zinc-200";

type Props = {
  /** Stored as 24h `HH:MM`. */
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

/**
 * Compact 12-hour time field: type hour (1–12) + minute (0–59), pick AM/PM.
 *
 * **Reuse:** `WeeklyScheduleEditor` table cells.
 */
export function ScheduleTimeInput({ value, onChange, disabled = false, "aria-label": ariaLabel }: Props) {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [hourError, setHourError] = useState<string | null>(null);
  const [minuteError, setMinuteError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = normalizeTimeToHHmm(value);
    const parts = parseHHmmTo12h(normalized);
    if (parts) {
      setHour(parts.hour12);
      setMinute(parts.minute);
      setPeriod(parts.period);
      setHourError(null);
      setMinuteError(null);
    } else if (!normalized) {
      setHour("");
      setMinute("");
      setPeriod("AM");
    }
  }, [value]);

  function tryCommit(h: string, m: string, p: "AM" | "PM") {
    const ht = h.trim();
    const mt = m.trim();
    if (!ht && !mt) {
      onChange("");
      setHourError(null);
      setMinuteError(null);
      return;
    }

    const hourOk = isValidHour12Input(ht);
    const minuteOk = isValidMinuteInput(mt);
    setHourError(hourOk ? null : "Hour must be 1–12");
    setMinuteError(minuteOk ? null : "Minute must be 0–59");
    if (!hourOk || !minuteOk || !ht || !mt) return;

    onChange(format12hPartsToHHmm(parseInt(ht, 10), parseInt(mt, 10), p));
  }

  const borderError = hourError || minuteError;

  return (
    <div className={wrapClass} aria-label={ariaLabel} aria-disabled={disabled}>
      <div
        className={cn(
          rowClass,
          borderError
            ? "border-red-400 ring-1 ring-red-400/30 dark:border-red-500"
            : "border-zinc-300 dark:border-zinc-600",
        )}
      >
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          disabled={disabled}
          value={hour}
          placeholder="6"
          aria-label={ariaLabel ? `${ariaLabel} hour` : "Hour"}
          aria-invalid={Boolean(hourError)}
          className={numClass}
          onChange={(e) => {
            setHour(sanitizeHour12Input(e.target.value));
            setHourError(null);
          }}
          onBlur={() => {
            if (hour && !isValidHour12Input(hour)) {
              setHourError("Hour must be 1–12");
              return;
            }
            const padded = normalizeMinuteInputOnBlur(minute);
            setMinute(padded);
            tryCommit(hour, padded, period);
          }}
        />
        <span className="text-zinc-400" aria-hidden>
          :
        </span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          disabled={disabled}
          value={minute}
          placeholder="00"
          aria-label={ariaLabel ? `${ariaLabel} minute` : "Minute"}
          aria-invalid={Boolean(minuteError)}
          className={`${numClass} w-9`}
          onChange={(e) => {
            setMinute(sanitizeMinuteInput(e.target.value));
            setMinuteError(null);
          }}
          onBlur={() => {
            if (minute && !isValidMinuteInput(minute)) {
              setMinuteError("Minute must be 0–59");
              return;
            }
            const padded = normalizeMinuteInputOnBlur(minute);
            setMinute(padded);
            tryCommit(hour, padded, period);
          }}
        />
        <select
          disabled={disabled}
          value={period}
          aria-label={ariaLabel ? `${ariaLabel} AM or PM` : "AM or PM"}
          className={periodClass}
          onChange={(e) => {
            const next = e.target.value as "AM" | "PM";
            setPeriod(next);
            tryCommit(hour, normalizeMinuteInputOnBlur(minute), next);
          }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {borderError ? <p className="text-[10px] leading-tight text-red-600 dark:text-red-400">{borderError}</p> : null}
    </div>
  );
}
