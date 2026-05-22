"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AssignTrainerInline, RosterTrainerLabel } from "@/components/dashboard/AssignTrainerInline";
import { formatInrPrice, profileInitials } from "@/lib/customers/format-inr";
import { rosterStatusDisplay } from "@/lib/customers/roster-status";
import type { TrainerLite } from "@/lib/customers/membership-detail";
import { dashboardCustomerMembershipPath } from "@/utils/routes";

export type CustomerRosterRow = {
  id: string;
  status: string;
  outlet_id: string;
  start_date: string | null;
  end_date: string | null;
  assigned_trainer_id: string | null;
  assigned_trainer_name: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  outlet: { name: string | null; city: string | null } | null;
  plan: { name: string; price?: number | null; currency?: string | null } | null;
};

/**
 * Searchable customer table for `/dashboard/customers`.
 * Row click opens profile; coach column supports inline assign when unassigned.
 */
export function CustomerRosterTable(props: {
  rows: CustomerRosterRow[];
  /** Outlet-scoped coaches for inline assign — from `listTrainersGroupedByOutlet`. */
  trainersByOutlet: Record<string, TrainerLite[]>;
  canAssignTrainer: boolean;
  /** When true, table sits inside a parent card (no outer border/radius). */
  embedded?: boolean;
}) {
  const { rows, trainersByOutlet, canAssignTrainer, embedded } = props;

  return (
    <div className={embedded ? "overflow-x-auto" : "overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"}>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <th className="px-4 py-3">Customer</th>
            <th className="hidden px-4 py-3 md:table-cell">Phone</th>
            <th className="hidden px-4 py-3 lg:table-cell">Email</th>
            <th className="px-4 py-3">Outlet</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Coach</th>
            <th className="hidden px-4 py-3 xl:table-cell">Term</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => {
            const status = rosterStatusDisplay(row.status, row.end_date);
            const href = dashboardCustomerMembershipPath(row.id);
            const planPrice =
              row.plan?.price != null
                ? formatInrPrice(row.plan.price, row.plan.currency ?? "INR")
                : null;
            const outletTrainers = trainersByOutlet[row.outlet_id] ?? [];

            return (
              <tr key={row.id} className="group transition hover:bg-orange-50/80 dark:hover:bg-orange-950/20">
                <td className="px-4 py-3">
                  <Link href={href} className="flex items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
                      aria-hidden
                    >
                      {profileInitials(row.profile?.full_name)}
                    </span>
                    <span>
                      <span className="font-semibold text-zinc-900 group-hover:text-orange-600 dark:text-zinc-50 dark:group-hover:text-orange-400">
                        {row.profile?.full_name ?? "Unnamed"}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500 md:hidden">
                        {row.profile?.phone ?? row.profile?.email ?? "—"}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 md:table-cell">
                  <Link href={href} className="block">
                    {row.profile?.phone ?? "—"}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-zinc-600 dark:text-zinc-400 lg:table-cell">
                  <Link href={href} className="block">
                    {row.profile?.email ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  <Link href={href} className="block">
                    {row.outlet?.name ?? "—"}
                    {row.outlet?.city ? (
                      <span className="text-zinc-400"> · {row.outlet.city}</span>
                    ) : null}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={href} className="block">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.plan?.name ?? "—"}</span>
                    {planPrice ? (
                      <span className="mt-0.5 block text-xs text-zinc-500">{planPrice}</span>
                    ) : null}
                  </Link>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {canAssignTrainer && !row.assigned_trainer_id && outletTrainers.length > 0 ? (
                    <AssignTrainerInline
                      membershipId={row.id}
                      outletId={row.outlet_id}
                      assignedTrainerId={row.assigned_trainer_id}
                      assignedTrainerName={row.assigned_trainer_name}
                      trainers={outletTrainers}
                    />
                  ) : (
                    <RosterTrainerLabel
                      assignedTrainerId={row.assigned_trainer_id}
                      assignedTrainerName={row.assigned_trainer_name}
                    />
                  )}
                </td>
                <td className="hidden px-4 py-3 text-xs tabular-nums text-zinc-600 dark:text-zinc-400 xl:table-cell">
                  <Link href={href} className="block">
                    {row.start_date ?? "—"} → {row.end_date ?? "Open"}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={href}>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
