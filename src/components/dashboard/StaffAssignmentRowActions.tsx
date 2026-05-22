import Link from "next/link";
import { dashboardStaffAssignmentPath } from "@/utils/routes";

type Props = {
  assignmentId: string;
};

/**
 * Roster row action — opens staff detail (profile, branches, and edits live there).
 *
 * **Reuse:** Keep a single action here; branch changes use the detail page `#branch-access` section.
 */
export function StaffAssignmentRowActions({ assignmentId }: Props) {
  return (
    <Link
      href={dashboardStaffAssignmentPath(assignmentId)}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
    >
      View
    </Link>
  );
}
