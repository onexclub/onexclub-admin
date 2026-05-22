"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assignTrainerToMembershipAction, type SimpleActionState } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import type { TrainerLite } from "@/lib/customers/membership-detail";
import { trainerDisplayLabel } from "@/lib/admin/outlet-trainers";

/**
 * Roster cell — assign a coach without opening the full profile.
 * **Reuse:** `CustomerRosterTable` trainer column.
 */
export function AssignTrainerInline(props: {
  membershipId: string;
  outletId: string;
  assignedTrainerId: string | null;
  assignedTrainerName: string | null;
  trainers: TrainerLite[];
}) {
  const { membershipId, assignedTrainerId, assignedTrainerName, trainers } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(assignTrainerToMembershipAction, {} as SimpleActionState);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  if (assignedTrainerId && assignedTrainerName) {
    return <span className="font-medium text-zinc-800 dark:text-zinc-100">{assignedTrainerName}</span>;
  }

  if (!trainers.length) {
    return <span className="text-zinc-400">—</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-md px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/40"
      >
        Assign coach
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex min-w-[10rem] flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="membership_id" value={membershipId} />
      <select
        name="trainer_profile_id"
        required
        defaultValue=""
        className="mt-0 w-full min-w-[9rem] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value="" disabled>
          Choose coach…
        </option>
        {trainers.map((t) => (
          <option key={t.id} value={t.id}>
            {trainerDisplayLabel(t)}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={pending} className="h-7 px-2 text-xs">
          {pending ? "…" : "Save"}
        </Button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
      {state.error ? <p className="text-[10px] text-rose-600">{state.error}</p> : null}
    </form>
  );
}

/** Read-only coach label for roster when user cannot assign. */
export function RosterTrainerLabel(props: {
  assignedTrainerId: string | null;
  assignedTrainerName: string | null;
}) {
  const { assignedTrainerId, assignedTrainerName } = props;
  if (!assignedTrainerId) return <span className="text-zinc-400">Unassigned</span>;
  return <span className="text-zinc-700 dark:text-zinc-300">{assignedTrainerName ?? "Coach"}</span>;
}

export { trainerDisplayLabel };
