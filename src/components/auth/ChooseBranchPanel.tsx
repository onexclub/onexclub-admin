"use client";

import { useActionState } from "react";
import { ACTIVE_BRANCH_ALL } from "@/lib/auth/active-branch-constants";
import type { ChooseBranchState } from "@/app/auth/choose-branch/actions";
import { setActiveBranchAction } from "@/app/auth/choose-branch/actions";

const initial: ChooseBranchState = {};

export type ChooseBranchOption = {
  id: string;
  name: string;
  city: string | null;
};

/**
 * Post-login branch picker for gym admins with multiple outlets.
 * **Reuse:** rendered from `/auth/choose-branch`; same cookie as {@link ActiveBranchSwitcher}.
 */
export function ChooseBranchPanel({
  branches,
  nextPath,
  userName,
}: {
  branches: ChooseBranchOption[];
  nextPath: string;
  userName: string;
}) {
  const [state, formAction, pending] = useActionState(setActiveBranchAction, initial);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Choose a branch</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Hi {userName} — pick where you want to work today. You can switch anytime from the dashboard header.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="next" value={nextPath} />

        {branches.map((b) => (
          <button
            key={b.id}
            type="submit"
            name="outlet_id"
            value={b.id}
            disabled={pending}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-4 text-left transition hover:border-orange-300 hover:bg-orange-50/80 disabled:opacity-60"
          >
            <span>
              <span className="block font-semibold text-zinc-900">{b.name}</span>
              {b.city?.trim() ? (
                <span className="mt-0.5 block text-sm text-zinc-500">{b.city.trim()}</span>
              ) : null}
            </span>
            <span className="text-sm font-medium text-orange-700">Select</span>
          </button>
        ))}

        <button
          type="submit"
          name="outlet_id"
          value={ACTIVE_BRANCH_ALL}
          disabled={pending}
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-left transition hover:border-orange-300 hover:bg-orange-50/50 disabled:opacity-60"
        >
          <span>
            <span className="block font-semibold text-zinc-900">All branches</span>
            <span className="mt-0.5 block text-sm text-zinc-500">Combined view — filter per page as needed</span>
          </span>
          <span className="text-sm font-medium text-orange-700">Select</span>
        </button>
      </form>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}
    </div>
  );
}
