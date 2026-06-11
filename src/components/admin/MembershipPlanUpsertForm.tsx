"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveMembershipPlanAction, type MembershipPlanMutationState } from "@/app/admin/plans/actions";
import type { BillingCycleDb } from "@/types/database.types";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";

type OutletOption = { id: string; name: string; city: string | null };

const initial: MembershipPlanMutationState = {};

const BILLING: { value: BillingCycleDb; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "yearly", label: "Yearly" },
];

function featuresDefault(plan?: MembershipPlanAdminRow | null): string {
  if (!plan?.features_json || typeof plan.features_json !== "object") return '{\n  "locker_included": false,\n  "guest_passes_per_month": 0\n}';
  try {
    return JSON.stringify(plan.features_json, null, 2);
  } catch {
    return "{}";
  }
}

/**
 * Combined create/update editor for outlet catalogue tiers.
 *
 * Wired to {@link saveMembershipPlanAction}: omit hidden `plan_id` for inserts, populate it for edits.
 * Parent should change `editorKey` when switching drafts so browsers reset unconstrained defaults.
 */
export function MembershipPlanUpsertForm(props: {
  outlets: OutletOption[];
  outletLookup: Record<string, OutletOption | undefined>;
  /** `null` = create new plan */
  draft: MembershipPlanAdminRow | null;
  editorKey: string;
  onCancel: () => void;
}) {
  const { outlets, outletLookup, draft, editorKey, onCancel } = props;
  const router = useRouter();

  const isEdit = draft != null;
  const outlet = draft ? outletLookup[draft.outlet_id] : undefined;

  const [state, formAction, pending] = useActionState(saveMembershipPlanAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form
      key={editorKey}
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-lg ring-1 ring-zinc-900/5 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-950 dark:ring-white/10"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-700">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {isEdit ? `Edit “${draft.name}”` : "New membership plan"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Changes apply to new sign-ups and renewals. Members already on this plan will see updated benefits and rules
            after you save.
          </p>
          {isEdit ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              This plan belongs to{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{outlet?.name ?? "this branch"}</span>
              {outlet?.city ? ` (${outlet.city})` : ""}.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Close editor
        </button>
      </div>

      {isEdit ? <input type="hidden" name="plan_id" value={draft.id} /> : null}

      {!isEdit ? (
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Branch
          <select
            name="outlet_id"
            required
            defaultValue={outlets[0]?.id}
            className={inputCn}
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.city ? ` — ${o.city}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="outlet_id" value={draft.outlet_id} />
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Plan name
        <input name="name" required className={inputCn} placeholder="Premium multi-branch" defaultValue={draft?.name ?? ""} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Description — shown to staff and members
        <textarea name="description" rows={3} className={inputCn + " resize-y"} placeholder="Locker access, PT sessions, and more…" defaultValue={draft?.description ?? ""} />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Price
          <input
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="2499"
            className={inputCn}
            defaultValue={draft?.price ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Currency
          <input name="currency" defaultValue={draft?.currency ?? "INR"} maxLength={3} required className={inputCn} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Billing cycle
          <select name="billing_cycle" className={inputCn} defaultValue={(draft?.billing_cycle as BillingCycleDb) ?? "monthly"}>
            {BILLING.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Membership length in days (leave blank for open-ended plans)
        <input
          name="duration_days"
          type="number"
          min={1}
          step={1}
          className={inputCn}
          placeholder="e.g. 30"
          defaultValue={draft?.duration_days ?? ""}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Display order (lower numbers appear first)
          <input name="display_order" type="number" defaultValue={draft?.display_order ?? 0} className={inputCn} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Card accent color
          <input name="color_hex" className={inputCn} placeholder="#7F77DD" defaultValue={draft?.color_hex ?? ""} />
        </label>
      </div>

      <fieldset className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
          Cross-branch access
        </legend>
        <label className="mt-3 flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <input name="allow_cross_branch" type="checkbox" defaultChecked={draft?.allow_cross_branch ?? false} className="mt-1 shrink-0" />
          Allow members to visit other branches on this plan.
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Visit limit (number, or type unlimited)
            <input
              name="cross_branch_visits_allowed"
              className={inputCn}
              placeholder="30 or unlimited"
              defaultValue={
                draft?.allow_cross_branch ? (draft.cross_branch_visits_allowed == null ? "unlimited" : String(draft.cross_branch_visits_allowed)) : ""
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            How often the limit resets
            <select name="cross_branch_quota_period" className={inputCn} defaultValue={draft?.cross_branch_quota_period ?? "monthly"}>
              <option value="monthly">Resets every month</option>
              <option value="total">Lifetime limit</option>
            </select>
          </label>
        </div>

        <label className="mt-4 flex gap-3 text-xs text-zinc-700 dark:text-zinc-300">
          <input name="cross_branch_org_only" type="checkbox" defaultChecked={draft?.cross_branch_org_only ?? true} className="mt-1 shrink-0" />
          Only allow visits to other branches in the same gym brand.
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Extra perks (optional)
        <textarea
          name="features_json"
          rows={5}
          className={monoInputCn}
          spellCheck={false}
          placeholder='{"locker_included":true,"freeze_allowed":true}'
          defaultValue={featuresDefault(draft)}
        />
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          Add perks as key–value pairs. They appear as bullet points on the plan card.
        </span>
      </label>

      {state.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-100">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-50">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-orange-600 px-6 text-sm font-semibold text-white shadow-md shadow-orange-600/25 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
      >
        {pending ? "Saving…" : isEdit ? "Save changes" : "Create plan"}
      </button>
    </form>
  );
}

const inputCn =
  "rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 outline-none ring-orange-500/25 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const monoInputCn =
  inputCn + " font-mono text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100";
