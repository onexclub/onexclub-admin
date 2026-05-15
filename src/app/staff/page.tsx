import Link from "next/link";
import { getAuthDashboardContext } from "@/services/auth.service";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/utils/routes";

export default async function StaffHomePage() {
  const ctx = await getAuthDashboardContext();
  const outletCount = ctx.staffAssignments.length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Assigned outlets" value={outletCount} hint="From `staff_assignments`" />
        <StatCard label="Role" value="Staff" hint="Limited to outlet operations" />
      </section>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Today</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Review members and record attendance from the{" "}
          <Link className="font-medium text-orange-700 hover:underline dark:text-orange-400" href={`${ROUTES.staff}/members`}>
            members
          </Link>{" "}
          screen.
        </p>
      </div>
    </div>
  );
}
