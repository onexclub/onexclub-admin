"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";
import { syncStaffBranchAssignmentsAction, type StaffActionState } from "@/app/dashboard/staff/actions";
import { StaffBranchPickerFields } from "@/components/dashboard/StaffBranchPickerFields";
import { ASSIGNABLE_ROLES, ROLE_META, type AssignableStaffRole, type UserRole } from "@/lib/auth/roles";
import type { StaffBranchAssignmentRow } from "@/lib/admin/staff-branch-assignments";
import { dashboardStaffAssignmentPath } from "@/utils/routes";

type OutletOption = { id: string; name: string | null };

type Props = {
  assignmentId: string;
  currentOutletId: string;
  role: string;
  outlets: OutletOption[];
  branchAssignments: StaffBranchAssignmentRow[];
};

const fieldClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

/**
 * Branch access editor on the staff detail page (`#branch-access`).
 *
 * **Reuse:** `StaffBranchPickerFields` + `parseStaffBranchFormSelection` / `syncStaffProfileBranchAccess`.
 */
export function StaffBranchAccessSection({
  assignmentId,
  currentOutletId,
  role,
  outlets,
  branchAssignments,
}: Props) {
  const initialOutletIds = useMemo(
    () => branchAssignments.map((a) => a.outletId),
    [branchAssignments],
  );
  const initialPrimary = branchAssignments.find((a) => a.isPrimary)?.outletId ?? currentOutletId;

  const [state, action, pending] = useActionState(syncStaffBranchAssignmentsAction, {} as StaffActionState);

  const roleSlugs = ASSIGNABLE_ROLES as readonly string[];
  const isAssignable = roleSlugs.includes(role);
  const outletNameById = Object.fromEntries(outlets.map((o) => [o.id, o.name ?? o.id]));

  return (
    <section
      id="branch-access"
      className="scroll-mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Branch access</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Assign one branch or the same role at several — useful for a branch admin who covers every location.
      </p>

      {branchAssignments.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {branchAssignments.map((a) => (
            <li key={a.id}>
              <Link
                href={dashboardStaffAssignmentPath(a.id)}
                className="inline-flex rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-800 hover:border-orange-300 hover:text-orange-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                {outletNameById[a.outletId] ?? a.outletId}
                {a.isPrimary ? " · primary" : ""}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="assignment_id" value={assignmentId} />

        <StaffBranchPickerFields
          outlets={outlets}
          defaultOutletId={currentOutletId}
          initialSelectedIds={initialOutletIds}
          initialPrimaryId={initialPrimary}
        />

        {isAssignable ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Role (applied at every selected branch)
            <select name="role" defaultValue={role} className={fieldClass}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r as UserRole].label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="role" value={role} />
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Save branch access"}
        </button>
        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{state.success}</p> : null}
      </form>
    </section>
  );
}
