import Link from "next/link";
import { dashboardStaffAssignmentPath } from "@/utils/routes";

type Props = {
  assignmentId: string;
  canManage: boolean;
};

/**
 * Compact View / Edit affordances for roster rows.
 *
 * **Reuse:** Edit lives on the staff detail page (`?edit=1`); row actions stay minimal.
 */
export function StaffAssignmentRowActions({ assignmentId, canManage }: Props) {
  const base = dashboardStaffAssignmentPath(assignmentId);

  return (
    <div className="inline-flex items-center justify-end gap-2">
      <Link
        href={base}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        View
      </Link>
      {canManage ? (
        <Link
          href={`${base}?edit=1`}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Edit
        </Link>
      ) : null}
    </div>
  );
}
