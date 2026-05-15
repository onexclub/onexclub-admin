"use client";

import { useActionState, useMemo, useState } from "react";
import { staffCheckInAction, type StaffCheckInState } from "@/app/staff/members/actions";

type MemberRow = {
  membershipId: string;
  outletId: string;
  profileId: string;
  fullName: string | null;
  email: string | null;
};

type OutletRow = { id: string; name: string };

const initial: StaffCheckInState = {};

export function StaffMembersPanel({
  members,
  outlets,
}: {
  members: MemberRow[];
  outlets: OutletRow[];
}) {
  // This panel lists **gym members** (customer passes), not staff_assignments teammates.
  // Teammate roster + invites live under `/dashboard/staff`.
  const [state, formAction, pending] = useActionState(staffCheckInAction, initial);
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");

  const filtered = useMemo(
    () => members.filter((m) => (outletId ? m.outletId === outletId : true)),
    [members, outletId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Outlet filter
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((m) => (
              <tr key={m.membershipId}>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  {m.fullName ?? "Unnamed"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{m.email ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <form action={formAction} className="inline">
                    <input type="hidden" name="outlet_id" value={m.outletId} />
                    <input type="hidden" name="profile_id" value={m.profileId} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="text-sm font-medium text-orange-700 hover:underline disabled:opacity-50 dark:text-orange-400"
                    >
                      Check in
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-100">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
