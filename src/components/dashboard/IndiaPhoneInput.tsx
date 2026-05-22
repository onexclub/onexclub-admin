"use client";

import {
  DEFAULT_PHONE_COUNTRY_CODE,
  formatPhoneLocalDigits,
  sanitizeIndianLocalPhoneInput,
} from "@/lib/auth/phone-e164";
import { cn } from "@/lib/utils/cn";

/**
 * Mobile field with fixed `+91` prefix — staff type 10 digits; server normalizes to E.164.
 *
 * **Reuse:** customer onboard wizard (`CustomerOnboardWizard`). Profile edit can keep free-form
 * tel input until migrated; comparison still uses {@link normalizeToE164} in server actions.
 */
export function IndiaPhoneInput(props: {
  id?: string;
  label: string;
  labelClassName?: string;
  /** Local 10-digit value, or E.164 / legacy string (display is normalized). */
  value: string;
  onChange: (localDigits: string) => void;
  inputClassName?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const {
    id,
    label,
    labelClassName,
    value,
    onChange,
    inputClassName,
    disabled,
    autoComplete = "tel-national",
  } = props;

  const displayLocal = formatPhoneLocalDigits(value);

  return (
    <label className="block" htmlFor={id}>
      <span className={labelClassName}>{label}</span>
      <div
        className={cn(
          "mt-1.5 flex overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80 ring-orange-500/25 transition focus-within:border-orange-500 focus-within:bg-white focus-within:ring-4 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus-within:bg-zinc-950",
          disabled && "opacity-60",
        )}
      >
        <span
          className="flex shrink-0 items-center border-r border-zinc-200 bg-zinc-100/90 px-3 text-sm font-medium tabular-nums text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
          aria-hidden
        >
          +{DEFAULT_PHONE_COUNTRY_CODE}
        </span>
        <input
          id={id}
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 outline-none dark:text-zinc-50",
            inputClassName,
          )}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          disabled={disabled}
          value={displayLocal}
          onChange={(e) => onChange(sanitizeIndianLocalPhoneInput(e.target.value))}
          placeholder="98765 43210"
          maxLength={10}
          aria-describedby={id ? `${id}-hint` : undefined}
        />
      </div>
      {id ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          10-digit Indian mobile — country code +{DEFAULT_PHONE_COUNTRY_CODE} is added automatically.
        </p>
      ) : null}
    </label>
  );
}
