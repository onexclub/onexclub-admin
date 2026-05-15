"use client";

/**
 * Mirrors required address validation in `addBranchAction` (superadmin/gyms/actions.ts).
 * Reuse pattern: onboarding form uses the same field split for the first outlet.
 *
 * Server: after insert, `addBranchAction` calls `syncGymOwnerAssignmentsForOutlet` so every org
 * `gym_owner` gets a `staff_assignments` row on the new outlet (cross-branch visibility / RLS helpers).
 */

import { useActionState } from "react";
import type { AddBranchState } from "@/app/superadmin/gyms/actions";
import { addBranchAction } from "@/app/superadmin/gyms/actions";

const initial: AddBranchState = {};

export function AddBranchForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(addBranchAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="organization_id" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Branch name
          <input
            name="branch_name"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Street address <span className="text-red-600 dark:text-red-400">*</span>
          <input
            name="address"
            required
            autoComplete="street-address"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          City <span className="text-red-600 dark:text-red-400">*</span>
          <input
            name="city"
            required
            autoComplete="address-level2"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          State / region <span className="text-red-600 dark:text-red-400">*</span>
          <input
            name="state"
            required
            autoComplete="address-level1"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Country (ISO, 2 letters)
          <input
            name="country"
            placeholder="IN"
            maxLength={2}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">Leave blank for IN.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Phone (optional)
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-orange-600 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Creating…" : "Create branch"}
      </button>
    </form>
  );
}
