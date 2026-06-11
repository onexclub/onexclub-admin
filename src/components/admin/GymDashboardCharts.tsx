"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ROUTES } from "@/utils/routes";
import type {
  GymBranchMetricRow,
  GymJoinTrendPoint,
  GymPlanSlice,
  GymStaffRoleSlice,
  GymStatusSlice,
} from "@/lib/admin/gym-dashboard-data";

/**
 * Gym-admin analytics charts for `/dashboard` and `/admin`.
 *
 * Reuse / moderation:
 * - Chart **data** is built server-side by `buildGymDashboardChartModel` in
 *   `@/lib/admin/gym-dashboard-data`.
 * - Stagger animation uses `.dashboard-rise*` from `src/app/globals.css` (same as superadmin).
 */

type Props = {
  branchMetrics: GymBranchMetricRow[];
  statusMix: GymStatusSlice[];
  staffRoles: GymStaffRoleSlice[];
  planMix: GymPlanSlice[];
  joinTrend: GymJoinTrendPoint[];
  report: {
    totalCustomers: number;
    payingMembers: number;
    activeMembers: number;
    staffCount: number;
    checkInsLast30Days: number;
    avgMembersPerBranch: number;
  };
  /** Single-location gyms hide branch comparison; multi shows it when viewing all branches. */
  scopeMode?: "single" | "multi";
  scopeLabel?: string;
  /** Where customer list links should point (dashboard vs legacy admin). */
  customersHref?: string;
  staffHref?: string;
};

const AXIS_TICK = { fill: "#a1a1aa", fontSize: 11 };
const GRID_STROKE = "#3f3f46";
const BAR_ORANGE = "#f97316";
const BAR_AMBER = "#f59e0b";
const LINE_EMERALD = "#34d399";
const PIE_COLORS = ["#f97316", "#ea580c", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#fb923c", "#fdba74"];

function truncateLabel(s: string, max = 20) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function GymDashboardCharts({
  branchMetrics,
  statusMix,
  staffRoles,
  planMix,
  joinTrend,
  report,
  scopeMode = "multi",
  scopeLabel,
  customersHref = ROUTES.dashboardCustomers,
  staffHref = ROUTES.dashboardStaff,
}: Props) {
  const isSingleBranch = scopeMode === "single";
  const showBranchComparison = !isSingleBranch && branchMetrics.length > 1;
  const locationHint = isSingleBranch ? "At this location" : scopeLabel ? `For ${scopeLabel}` : "All locations";

  const branchesForChart = branchMetrics.map((r) => ({
    ...r,
    shortName: truncateLabel(r.name),
  }));

  const plansForChart = planMix.map((r) => ({
    ...r,
    shortPlan: truncateLabel(r.plan, 16),
  }));

  const nonPayingMembers = Math.max(0, report.totalCustomers - report.payingMembers);
  const payingMix = [
    { label: "Paying", count: report.payingMembers },
    { label: "Not on plan", count: nonPayingMembers },
  ].filter((s) => s.count > 0);

  const payingRate =
    report.totalCustomers > 0 ? Math.round((report.payingMembers / report.totalCustomers) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="dashboard-rise grid gap-3 rounded-xl border border-zinc-700/80 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 p-4 shadow-lg shadow-orange-950/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ReportTile label="Total customers" value={report.totalCustomers} hint={locationHint} />
        <ReportTile label="Paying members" value={report.payingMembers} hint="Plan or payment on file" />
        <ReportTile label="Active members" value={report.activeMembers} hint="Status = active" />
        <ReportTile label="Staff" value={report.staffCount} hint={locationHint} />
        <ReportTile label="Check-ins (30d)" value={report.checkInsLast30Days} hint="Visits logged" />
        {isSingleBranch ? (
          <ReportTile label="On a plan" value={`${payingRate}%`} hint="Paying share of members" />
        ) : (
          <ReportTile
            label="Avg. / branch"
            value={report.avgMembersPerBranch.toFixed(1)}
            hint="Members per location"
          />
        )}
      </div>

      <div className="dashboard-rise dashboard-rise-delay-1 grid gap-4 min-[1100px]:grid-cols-2">
        <ChartCard
          title="Membership status"
          subtitle={isSingleBranch ? "Customer breakdown at your gym" : "All customers across selected branches"}
        >
          <div className="h-[300px] w-full">
            {statusMix.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">No members yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={statusMix}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={92}
                    paddingAngle={2}
                    animationDuration={1000}
                  >
                    {statusMix.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#27272a" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${Number(value ?? 0)} members`, "Count"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
                    formatter={(value) => <span className="text-zinc-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Staff by role" subtitle={isSingleBranch ? "Your team at this location" : "Active assignments at selected branches"}>
          <div className="h-[300px] w-full">
            {staffRoles.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">No staff yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffRoles} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="role" tick={AXIS_TICK} stroke={GRID_STROKE} />
                  <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(245, 158, 11, 0.08)" }}
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${Number(value ?? 0)} people`, "Staff"]}
                  />
                  <Bar dataKey="count" name="Staff" fill={BAR_AMBER} radius={[6, 6, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="dashboard-rise dashboard-rise-delay-2 grid gap-4 min-[1100px]:grid-cols-2">
        {showBranchComparison ? (
          <ChartCard title="Members by branch" subtitle="Total vs paying (plan or payment on file)">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchesForChart} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                  <YAxis type="category" dataKey="shortName" width={100} tick={AXIS_TICK} stroke={GRID_STROKE} />
                  <Tooltip
                    cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(_, payload) => (payload[0]?.payload?.name as string) ?? ""}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
                  <Bar
                    dataKey="members"
                    name="All members"
                    fill={BAR_ORANGE}
                    radius={[0, 4, 4, 0]}
                    animationDuration={900}
                  />
                  <Bar
                    dataKey="payingMembers"
                    name="Paying"
                    fill={LINE_EMERALD}
                    radius={[0, 4, 4, 0]}
                    animationDuration={950}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : (
          <ChartCard title="Paying vs not on plan" subtitle="Members with a plan or payment on file">
            <div className="h-[320px] w-full">
              {payingMix.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-zinc-500">No members yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={payingMix}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={96}
                      paddingAngle={2}
                      animationDuration={1000}
                    >
                      {payingMix.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? LINE_EMERALD : PIE_COLORS[1]}
                          stroke="#27272a"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${Number(value ?? 0)} members`, "Count"]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
                      formatter={(value) => <span className="text-zinc-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        )}

        <ChartCard title="Plan distribution" subtitle="Top plans assigned to members">
          <div className="h-[320px] w-full">
            {plansForChart.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">No plan data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plansForChart} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                  <YAxis type="category" dataKey="shortPlan" width={100} tick={AXIS_TICK} stroke={GRID_STROKE} />
                  <Tooltip
                    cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(_, payload) => (payload[0]?.payload?.plan as string) ?? ""}
                    formatter={(value) => [`${Number(value ?? 0)} members`, "Assigned"]}
                  />
                  <Bar dataKey="count" name="Members" fill={BAR_ORANGE} radius={[0, 6, 6, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      {joinTrend.length > 1 ? (
        <div className="dashboard-rise dashboard-rise-delay-3">
          <ChartCard title="New member joins" subtitle={isSingleBranch ? "Monthly sign-ups at your gym" : "Monthly sign-ups across selected branches"}>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={joinTrend} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                  <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${Number(value ?? 0)} joins`, "Members"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="joins"
                    name="Joins"
                    stroke={BAR_ORANGE}
                    strokeWidth={2}
                    dot={{ fill: BAR_ORANGE, r: 4 }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      ) : null}

      <p className="dashboard-rise dashboard-rise-delay-4 text-center text-xs text-zinc-500">
        Drill into{" "}
        <Link href={customersHref} className="font-medium text-orange-400 hover:underline">
          Customers
        </Link>{" "}
        or{" "}
        <Link href={staffHref} className="font-medium text-orange-400 hover:underline">
          Staff
        </Link>{" "}
        for full rosters and actions.
      </p>
    </div>
  );
}

function ReportTile({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4 shadow-md transition-shadow duration-300 hover:shadow-lg hover:shadow-orange-950/15">
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
