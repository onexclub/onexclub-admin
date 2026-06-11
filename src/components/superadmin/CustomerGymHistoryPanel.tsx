import Link from "next/link";

import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";
import type { CustomerGymHistoryRow } from "@/lib/superadmin/customer-gym-history";
import { formatRosterStatusLabel } from "@/lib/superadmin/platform-customers-roster";
import {
  superadminCustomerMembershipPath,
  superadminGymBranchPath,
  superadminGymOrganizationPath,
} from "@/utils/routes";

const linkClass = "font-medium text-orange-700 hover:underline dark:text-orange-400";

/**
 * Gym memberships for one member — superadmin customer profile.
 *
 * **Data:** {@link fetchCustomerGymMembershipHistory}
 */
export function CustomerGymHistoryPanel(props: {
  rows: CustomerGymHistoryRow[];
  currentMembershipId: string;
}) {
  const { rows, currentMembershipId } = props;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Gym memberships</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Gyms and branches this member is linked to.
      </p>

      {!rows.length ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No gym memberships yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Gym</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Dates</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => {
                const isCurrent = row.id === currentMembershipId;
                const orgHref =
                  row.organization_id != null
                    ? superadminGymOrganizationPath(row.organization_id)
                    : null;
                const branchHref =
                  row.organization_id != null
                    ? superadminGymBranchPath(row.organization_id, row.outlet_id)
                    : null;

                return (
                  <tr
                    key={row.id}
                    className={isCurrent ? "bg-orange-50/60 dark:bg-orange-950/20" : undefined}
                  >
                    <td className="px-4 py-3">
                      {orgHref && row.organization_name ? (
                        <Link href={orgHref} className={linkClass}>
                          {row.organization_name}
                        </Link>
                      ) : (
                        <span className="text-zinc-700 dark:text-zinc-300">{row.organization_name ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {branchHref && row.branch_name ? (
                        <Link href={branchHref} className={linkClass}>
                          {row.branch_name}
                          {row.branch_city ? ` · ${row.branch_city}` : ""}
                        </Link>
                      ) : (
                        <>
                          {row.branch_name ?? "—"}
                          {row.branch_city ? ` · ${row.branch_city}` : ""}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.plan_name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                      {formatRosterStatusLabel(row.status)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.start_date ?? "—"} → {row.end_date ?? "Open"}
                      {row.joined_at ? (
                        <span className="mt-0.5 block">
                          Joined {formatMembershipTimestampUtcLabel(row.joined_at)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isCurrent ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-950/80 dark:text-orange-100">
                          Current
                        </span>
                      ) : (
                        <Link
                          href={superadminCustomerMembershipPath(row.id)}
                          className="text-xs font-semibold text-orange-700 hover:underline dark:text-orange-400"
                        >
                          Switch
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
