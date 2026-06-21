"use client";

import { useEffect } from "react";
import { Unlink, X } from "lucide-react";

import type { RemoveProgramPlanScope } from "@/lib/customers/remove-program-plan-assignments";
import { Button } from "@/components/ui/button";

export type RemoveProgramPlanConfirmTarget = {
  scope: RemoveProgramPlanScope;
  title: string;
  description: string;
  planName?: string;
};

/**
 * Confirm before unlinking matched exercise/diet templates.
 * **Reuse:** {@link CustomerProgramPlansPanel} — per-card and “remove both” flows.
 */
export function RemoveProgramPlanConfirmDialog(props: {
  open: boolean;
  target: RemoveProgramPlanConfirmTarget | null;
  memberName: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { open, target, memberName, pending, onConfirm, onClose } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open || !target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-program-plan-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Unlink className="size-4" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider">Unlink program</p>
          </div>
          <h2 id="remove-program-plan-title" className="mt-2 pr-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {target.title}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{target.description}</p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {target.planName ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Current plan</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{target.planName}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Member: {memberName}</p>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Progress and assignment history are kept for records. You can assign or re-match a new program anytime from
            this page.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? "Removing…" : "Unlink program"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
