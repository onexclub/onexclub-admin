"use client";

import { Badge } from "@/components/ui/badge";
import type { QuestionsResponseRow } from "@/features/onboarding/types";

import { cn } from "@/lib/utils/cn";

/** Compact status ribbon used in tables/tabs/onboarding collapsibles — keep typography consistent via `Badge`. */
export function CompletionBadge(props: {
  isComplete: boolean;
  incompleteHint?: string;
  className?: string;
}) {
  const { isComplete, incompleteHint, className } = props;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge variant={isComplete ? "success" : "warning"}>{isComplete ? "Complete" : "In progress"}</Badge>
      {!isComplete && incompleteHint ? <span className="text-xs text-amber-800 dark:text-amber-100">{incompleteHint}</span> : null}
    </div>
  );
}

/** Meta row surfaced on profile onboarding tab summaries. */
export function ResponseMetaHints({
  row,
  profileLabelLookup,
}: {
  row?: QuestionsResponseRow | null;
  profileLabelLookup?: Record<string, string | null>;
}) {
  if (!row?.updated_at) return <p className="text-xs text-zinc-500">No drafts saved yet.</p>;
  const answeredBy = row.answered_by ? profileLabelLookup?.[row.answered_by] ?? row.answered_by.slice(0, 8) : "—";
  const editedBy = row.last_edited_by ? profileLabelLookup?.[row.last_edited_by] ?? row.last_edited_by.slice(0, 8) : answeredBy;

  return (
    <dl className="grid gap-1 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
      <div className="flex flex-col gap-0.5">
        <dt className="uppercase tracking-wide text-zinc-400">Updated</dt>
        <dd className="font-medium text-zinc-900 dark:text-zinc-100">{new Date(row.updated_at).toLocaleString()}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="uppercase tracking-wide text-zinc-400">Answered by</dt>
        <dd className="font-medium text-zinc-900 dark:text-zinc-100">{answeredBy}</dd>
      </div>
      <div className="flex flex-col gap-0.5 sm:col-span-2">
        <dt className="uppercase tracking-wide text-zinc-400">Last editor</dt>
        <dd className="font-medium text-zinc-900 dark:text-zinc-100">{editedBy}</dd>
      </div>
    </dl>
  );
}
