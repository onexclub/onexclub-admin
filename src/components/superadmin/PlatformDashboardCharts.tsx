"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ROUTES } from "@/utils/routes";
import type {
  PlatformOrgMetricRow,
  PlatformPlanTierSlice,
  PlatformTopBranchRow,
} from "@/lib/superadmin/platform-gyms-data";

/**
 * Platform analytics charts for `/superadmin`.
 *
 * Reuse / moderation:
 * - Chart **data** is built server-side by `buildPlatformDashboardChartModel` in
 *   `@/lib/superadmin/platform-gyms-data` so aggregation stays in one place.
 * - For a new consumer (e.g. export CSV, PDF), reuse that helper and map to another UI.
 * - Stagger animation uses `.dashboard-rise*` from `src/app/globals.css`.
 */

type Props = {
  orgMetrics: PlatformOrgMetricRow[];
  planTiers: PlatformPlanTierSlice[];
  topBranches: PlatformTopBranchRow[];
  /** Quick report figures (computed on server). */
  report: {
    orgsWithNoBranches: number;
    avgMembersPerBranch: number;
    activeOrgs: number;
  };
};

const AXIS_TICK = { fill: "#a1a1aa", fontSize: 11 };
const GRID_STROKE = "#3f3f46";
const BAR_ORANGE = "#f97316";
const BAR_AMBER = "#f59e0b";
const PIE_COLORS = ["#f97316", "#ea580c", "#fbbf24", "#fb923c", "#fdba74", "#fed7aa"];

function truncateLabel(s: string, max = 22) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function pickTopByMembers(rows: PlatformOrgMetricRow[], n: number) {
  return [...rows].sort((a, b) => b.members - a.members).slice(0, n);
}

function pickTopByBranches(rows: PlatformOrgMetricRow[], n: number) {
  return [...rows].sort((a, b) => b.branches - a.branches).slice(0, n);
}

export function PlatformDashboardCharts({ orgMetrics, planTiers, topBranches, report }: Props) {
  const byMembers = pickTopByMembers(orgMetrics, 12).map((r) => ({
    ...r,
    shortName: truncateLabel(r.name),
  }));
  const byBranches = pickTopByBranches(orgMetrics, 12).map((r) => ({
    ...r,
    shortName: truncateLabel(r.name),
  }));
  const branchLeaders = topBranches.map((r) => ({
    ...r,
    shortName: truncateLabel(r.name, 18),
  }));

  return (
    <div className="space-y-6">
      <div className="dashboard-rise grid gap-3 rounded-xl border border-zinc-700/80 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 p-4 shadow-lg shadow-orange-950/10 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active organizations</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{report.activeOrgs}</p>
          <p className="mt-1 text-xs text-zinc-400">Onboarded gym brands</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Avg. members / branch</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
            {report.avgMembersPerBranch.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Across all branches</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Orgs without branches</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-orange-300">{report.orgsWithNoBranches}</p>
          <p className="mt-1 text-xs text-zinc-400">Add locations from All gyms</p>
        </div>
      </div>

      <div className="dashboard-rise dashboard-rise-delay-1 grid gap-4 min-[1100px]:grid-cols-2">
        <ChartCard
          title="Active members by organization"
          subtitle="Top 12 by member count · links in All gyms"
        >
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMembers} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={108}
                  tick={AXIS_TICK}
                  stroke={GRID_STROKE}
                />
                <Tooltip
                  cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) => (payload[0]?.payload?.name as string) ?? ""}
                  formatter={(value) => [`${Number(value ?? 0)} members`, "Active"]}
                />
                <Bar dataKey="members" name="Members" fill={BAR_ORANGE} radius={[0, 6, 6, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Plan tier mix" subtitle="Organizations by billing tier">
          <div className="h-[320px] w-full">
            {planTiers.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-zinc-500">No tier data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={planTiers}
                    dataKey="count"
                    nameKey="tier"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={96}
                    paddingAngle={2}
                    animationDuration={1000}
                  >
                    {planTiers.map((_, i) => (
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
      </div>

      <div className="dashboard-rise dashboard-rise-delay-2 grid gap-4 min-[1100px]:grid-cols-2">
        <ChartCard title="Branch footprint" subtitle="Top 12 organizations by branch count">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBranches} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={108}
                  tick={AXIS_TICK}
                  stroke={GRID_STROKE}
                />
                <Tooltip
                  cursor={{ fill: "rgba(245, 158, 11, 0.08)" }}
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) => (payload[0]?.payload?.name as string) ?? ""}
                  formatter={(value) => [`${Number(value ?? 0)} branches`, "Branches"]}
                />
                <Bar dataKey="branches" name="Branches" fill={BAR_AMBER} radius={[0, 6, 6, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Top branches by members" subtitle="Highest active membership · per branch">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchLeaders} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={100}
                  tick={AXIS_TICK}
                  stroke={GRID_STROKE}
                />
                <Tooltip
                  cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) => {
                    const p = payload[0]?.payload as PlatformTopBranchRow | undefined;
                    return p ? `${p.name} · ${p.orgName}` : "";
                  }}
                  formatter={(value) => [`${Number(value ?? 0)} members`, "Active"]}
                />
                <Bar dataKey="members" name="Members" fill={BAR_ORANGE} radius={[0, 6, 6, 0]} animationDuration={950} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <p className="dashboard-rise dashboard-rise-delay-3 text-center text-xs text-zinc-500">
        Open an organization from{" "}
        <Link href={ROUTES.superadminGyms} className="font-medium text-orange-400 hover:underline">
          All gyms
        </Link>{" "}
        to manage branches and admins.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4 shadow-md transition-shadow duration-300 hover:shadow-lg hover:shadow-orange-950/15">
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
