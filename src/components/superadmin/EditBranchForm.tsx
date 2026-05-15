"use client";

/** Pre-filled outlet editor; validates with `updateBranchAction` alongside `AddBranchForm` address rules. Re-saves gym_owner links via `syncGymOwnerAssignmentsForOutlet` on success. */

import { useActionState } from "react";
import type { UpdateBranchState } from "@/app/superadmin/gyms/actions";
import { updateBranchAction } from "@/app/superadmin/gyms/actions";

const initial: UpdateBranchState = {};

export type EditBranchPrefill = {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export function EditBranchForm({
  branch,
  organizationName,
}: {
  branch: EditBranchPrefill;
  organizationName: string;
}) {
  const [state, formAction, pending] = useActionState(updateBranchAction, initial);

  const countryPlaceholder = branch.country.trim().length === 2 ? branch.country.trim().toUpperCase() : "IN";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="organization_id" value={branch.organizationId} />
      <input type="hidden" name="outlet_id" value={branch.id} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Editing branch under <span className="font-medium text-zinc-900 dark:text-zinc-50">{organizationName}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Branch name
          <input
            name="branch_name"
            required
            defaultValue={branch.name}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Street address <span className="text-red-600 dark:text-red-400">*</span>
          <input
            name="address"
            required
            defaultValue={branch.address ?? ""}
            autoComplete="street-address"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          City <span className="text-red-600 dark:text-red-400">*</span>
          <input
            name="city"
            required
            defaultValue={branch.city ?? ""}
            autoComplete="address-level2"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          State / region <span className="text-red-600 dark:text-red-400">*</span>
          <input
            name="state"
            required
            defaultValue={branch.state ?? ""}
            autoComplete="address-level1"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Country (ISO, 2 letters)
          <input
            name="country"
            placeholder={countryPlaceholder}
            maxLength={2}
            defaultValue={branch.country ? branch.country.trim().toUpperCase() : ""}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">Leave blank for IN.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Phone (optional)
          <input
            name="phone"
            type="tel"
            defaultValue={branch.phone ?? ""}
            autoComplete="tel"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Branch email (optional)
          <input
            name="email"
            type="email"
            defaultValue={branch.email ?? ""}
            autoComplete="email"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Status
          <select
            name="is_active"
            defaultValue={branch.is_active ? "true" : "false"}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
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
        {pending ? "Saving…" : "Save branch"}
      </button>
    </form>
  );
}
