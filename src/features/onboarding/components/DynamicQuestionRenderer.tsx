"use client";

import { useFormContext } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { QuestionDefinition } from "@/features/onboarding/types";

import { cn } from "@/lib/utils/cn";

function boundsFor(def: QuestionDefinition): { min: number; max: number; step: number } {
  const raw = def.validation_json;
  const min = typeof raw?.min === "number" ? raw.min : 0;
  const max = typeof raw?.max === "number" ? raw.max : min + 100;
  const step = typeof raw?.step === "number" ? raw.step : 1;
  return { min, max, step };
}

/**
 * Bridges `question_definitions.input_type` to shadcn-styled primitives (mobile-safe range + native `<select>`).
 *
 * **Reusability:** use this renderer for kiosk / tablet flows and mirror it in Flutter if you want parity.
 */
export function DynamicQuestionRenderer({ definition: def, disabled }: { definition: QuestionDefinition; disabled: boolean }) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={def.question_key}
      render={({ field, fieldState }) => (
        <FormItem className="space-y-3">
          <FormLabel className="flex flex-col gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span>{def.label}</span>
            {def.is_required ? <span className="text-xs font-normal text-rose-600 dark:text-rose-400">Required</span> : null}
          </FormLabel>
          {def.helper_text ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{def.helper_text}</p> : null}
          <FormControl>
            {renderInput(field, fieldState.error?.message ?? null, disabled, def)}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function renderInput(
  field: { value: unknown; onChange: (v: unknown) => void; onBlur: () => void; name?: string; ref?: React.RefCallback<HTMLElement> },
  _: string | null,
  disabled: boolean,
  def: QuestionDefinition,
) {
  switch (def.input_type) {
    case "boolean":
      return (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
          <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
          <span className="text-sm text-zinc-700 dark:text-zinc-200">{field.value ? "Yes" : "No"}</span>
        </div>
      );
    case "text":
      return (
        <Textarea
          rows={5}
          {...field}
          className={cn(disabled ? "opacity-70" : "")}
          value={typeof field.value === "string" ? field.value : ""}
          disabled={disabled}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          inputMode="decimal"
          step={boundsFor(def).step}
          value={typeof field.value === "number" || typeof field.value === "string" ? field.value : ""}
          disabled={disabled}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
        />
      );
    case "scale": {
      const { min, max, step } = boundsFor(def);
      const numeric =
        typeof field.value === "number"
          ? field.value
          : typeof field.value === "string"
            ? Number(field.value || min)
            : min;
      return (
        <div className="space-y-3">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            className={cn(
              "h-3 w-full touch-pan-x cursor-pointer accent-orange-600 disabled:opacity-60 dark:accent-orange-500",
              disabled && "cursor-not-allowed",
            )}
            value={Number.isFinite(numeric) ? numeric : min}
            disabled={disabled}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
          />
          <div className="flex items-center justify-between text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            <span>
              Min {min} · Current {numeric}
            </span>
            <span>Max {max}</span>
          </div>
        </div>
      );
    }
    case "select":
      return (
        <select
          className={cn(
            "min-h-[2.75rem] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500/20 focus-visible:border-orange-500 focus-visible:ring-4 disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50",
          )}
          disabled={disabled}
          value={(field.value as string) ?? ""}
          onBlur={field.onBlur}
          onChange={(e) => field.onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(def.options_json ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "multiselect":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {(def.options_json ?? []).map((opt) => {
            const current: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
            const checked = current.includes(opt.value);
            const toggle = () => {
              if (disabled) return;
              if (checked) field.onChange(current.filter((v) => v !== opt.value));
              else field.onChange([...current, opt.value]);
            };
            return (
              <div
                key={opt.value}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-pressed={checked}
                aria-disabled={disabled}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (disabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }}
                className={cn(
                  "flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20",
                  checked
                    ? "border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-50"
                    : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100",
                  disabled && "pointer-events-none cursor-not-allowed opacity-60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 shadow dark:border-zinc-700",
                    checked && "border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-600",
                  )}
                >
                  {checked ? (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      );
    default:
      return <p className="text-xs text-zinc-500">Unsupported question type ({def.input_type}).</p>;
  }
}
