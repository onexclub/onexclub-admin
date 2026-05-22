import type { ReactNode } from "react";

const labelCn = "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

/**
 * Label/value row used in onboarding review + customer profile summary cards.
 * **Reuse:** `CustomerOnboardWizard`, `CustomerMembershipWorkspace`.
 */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-100 py-2.5 last:border-0 dark:border-zinc-800">
      <dt className={labelCn}>{label}</dt>
      <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value || "—"}</dd>
    </div>
  );
}

export function ReviewCard(props: { title: string; children: ReactNode; className?: string }) {
  const { title, children, className } = props;
  return (
    <div className={`rounded-xl border border-zinc-200 p-4 dark:border-zinc-700 ${className ?? ""}`}>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <dl className="mt-2">{children}</dl>
    </div>
  );
}
