"use client";

import { useActionState } from "react";
import { assignMembershipPlanAction, type AssignMembershipPlanState } from "@/app/admin/customers/actions";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";

const assignInitial: AssignMembershipPlanState = {};

type Props = {
  membershipId: string;
  outletDisplay: string;
  status: string;
  profileLabel: string;
  /** Active catalogue rows scoped to `membership.outlet_id`; server filters before hydrate. */
  plans: MembershipPlanAdminRow[];
  defaultStartDate: string;
};

/**
 * Per-row toolbox for renewing / activating membership after offline payment.
 * Mirrors onboarding contract: choosing a catalogue row sets FK + optional term reset.
 *
 * Composition note: Parents should keep fetching plans alongside customers — see `/admin/customers/page.tsx`.
 */
export function MembershipAssignPlanPanel(props: Props) {
  const { membershipId, outletDisplay, status, profileLabel, plans, defaultStartDate } = props;

  const [state, action, pending] = useActionState(assignMembershipPlanAction, assignInitial);
  const isActive = status === "active";
  /** Non-active memberships always reset term dates server-side (`assignMembershipPlanAction`). */
  const needsTermResetByDefault = !isActive;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs shadow-inner dark:border-zinc-700 dark:bg-zinc-950/40">
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">Renew / attach plan ({profileLabel})</p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        Outlet: <span className="font-medium text-zinc-800 dark:text-zinc-100">{outletDisplay}</span> • Status{" "}
        <span className="font-mono">{status}</span>
      </p>

      {!plans.length ? (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-50">
          No active plans for this branch yet — create catalog rows first on the Membership plans page.
        </p>
      ) : null}

      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="membership_id" value={membershipId} />

        <label className="flex flex-col gap-1 font-medium text-zinc-700 dark:text-zinc-300">
          Plan
          <select
            name="plan_id"
            required={plans.length > 0}
            className={selectCn}
            defaultValue={plans[0]?.id}
            disabled={!plans.length}
          >
            {!plans.length ? <option value="">No catalogue rows yet</option> : null}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} • {fmtMoney(p.currency, p.price)} / {p.billing_cycle}
                {typeof p.duration_days === "number" ? ` • ${p.duration_days} days` : " • open term"}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-medium text-zinc-700 dark:text-zinc-300">
          Start date
          <input name="start_date" type="date" defaultValue={defaultStartDate} required className={selectCn} />
        </label>

        <label className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
          <input name="renew_dates" type="checkbox" disabled={needsTermResetByDefault} defaultChecked={needsTermResetByDefault} />
          Restart their membership dates using the length of this plan (inactive memberships always get new dates automatically)
        </label>

        <label className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
          <input name="record_offline_payment" type="checkbox" />
          Record that they paid offline (we stamp the catalogue price onto this membership)
        </label>

        <button
          type="submit"
          disabled={pending || !plans.length}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-orange-600 px-3 text-[11px] font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Applying…" : "Save membership plan"}
        </button>

        {state.error ? <p className="text-red-700 dark:text-red-300">{state.error}</p> : null}
        {state.success ? <p className="text-emerald-700 dark:text-emerald-300">{state.success}</p> : null}
      </form>
    </div>
  );
}

function fmtMoney(curr: string, price: number) {
  return `${curr.toUpperCase()} ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const selectCn =
  "rounded-md border border-zinc-300 bg-white px-2 py-2 text-[11px] text-zinc-900 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
