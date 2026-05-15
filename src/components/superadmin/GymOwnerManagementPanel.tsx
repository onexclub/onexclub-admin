"use client";

/**
 * Superadmin: view linked `gym_owner` profiles and reassign ownership for an organization.
 * Pairs with `reassignGymOwnerAction` + `loadOrganizationGymOwners`.
 */

import { useActionState } from "react";
import type { ReassignGymOwnerState } from "@/app/superadmin/gyms/actions";
import { reassignGymOwnerAction } from "@/app/superadmin/gyms/actions";
import type { OrganizationGymOwner } from "@/lib/superadmin/gym-owners";

const initial: ReassignGymOwnerState = {};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export function GymOwnerManagementPanel({
  organizationId,
  owners,
}: {
  organizationId: string;
  owners: OrganizationGymOwner[];
}) {
  const [state, formAction, pending] = useActionState(reassignGymOwnerAction, initial);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Gym owner</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Accounts with org-wide access via{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">staff_assignments.role = gym_owner</code>.
        </p>
      </div>

      {owners.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">gym_owner</code> staff assignment found
          for this brand. Use the form below to assign an owner (they will be linked to every branch).
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
          {owners.map((o) => (
            <li key={o.profile_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {o.full_name ?? "—"}
                  {o.is_primary ? (
                    <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950/50 dark:text-orange-200">
                      Primary
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{o.email}</p>
                {o.phone ? <p className="text-sm text-zinc-500">{o.phone}</p> : null}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Linked branches</p>
                <p className="mt-1">{o.branch_names.join(", ")}</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">{o.profile_id}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <input type="hidden" name="organization_id" value={organizationId} />
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {owners.length ? "Change gym owner" : "Assign gym owner"}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Revokes every existing <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">gym_owner</code> row for this
          org, then links the account below to all branches. Existing email → reuses profile; new email → requires a
          temporary password.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Owner full name
            <input name="owner_full_name" className={inputClass} autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Owner email <span className="text-red-600">*</span>
            <input name="owner_email" type="email" required className={inputClass} autoComplete="email" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Temporary password
            <input
              name="owner_password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
              placeholder="Required only for a brand-new Auth user"
            />
          </label>
        </div>
        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            {state.success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : owners.length ? "Update gym owner" : "Assign gym owner"}
        </button>
      </form>
    </section>
  );
}
