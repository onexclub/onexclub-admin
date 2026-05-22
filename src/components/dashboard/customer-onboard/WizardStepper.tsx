"use client";

import { cn } from "@/lib/utils/cn";
import { WIZARD_STEP_LABELS } from "@/lib/customers/customer-onboard-draft";

/** Thin top progress stepper — add-customer wizard + customer profile workspace. */
export function WizardStepper(props: {
  currentStep: number;
  className?: string;
  /** When set, step labels become buttons (profile workspace tab navigation). */
  onStepClick?: (step: number) => void;
}) {
  const { currentStep, className, onStepClick } = props;
  const interactive = typeof onStepClick === "function";

  return (
    <nav aria-label="Onboarding progress" className={cn("w-full", className)}>
      <ol className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {WIZARD_STEP_LABELS.map((label, idx) => {
          const isActive = idx === currentStep;
          const isComplete = idx < currentStep;
          const barCn = cn(
            "h-1 rounded-full transition-colors",
            isActive || isComplete ? "bg-orange-600 dark:bg-orange-500" : "bg-zinc-200 dark:bg-zinc-700",
          );
          const labelCn = cn(
            "text-[10px] font-semibold uppercase tracking-wider sm:text-xs",
            isActive
              ? "text-orange-600 dark:text-orange-400"
              : isComplete
                ? "text-orange-600/80 dark:text-orange-400/80"
                : "text-zinc-400 dark:text-zinc-500",
            interactive && "cursor-pointer hover:text-orange-700 dark:hover:text-orange-300",
          );

          const inner = (
            <>
              <div className={barCn} aria-hidden />
              <span className={labelCn}>{label}</span>
            </>
          );

          return (
            <li key={label} className="flex flex-col gap-2">
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onStepClick(idx)}
                  aria-current={isActive ? "step" : undefined}
                  className="flex flex-col gap-2 text-left"
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
