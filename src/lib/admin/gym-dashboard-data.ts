import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gym-admin dashboard analytics — scoped to outlets the caller may manage (RLS + `effectiveManagedOutletIds`).
 *
 * **Reuse:** import `loadGymDashboardSnapshot` + `buildGymDashboardChartModel` from any Server Component
 * that already resolved outlet ids (`/dashboard`, `/admin`). Mirrors the superadmin pattern in
 * `@/lib/superadmin/platform-gyms-data` + `PlatformDashboardCharts`.
 */

export type GymBranchMetricRow = {
  id: string;
  name: string;
  members: number;
  payingMembers: number;
  staff: number;
};

export type GymStatusSlice = {
  status: string;
  count: number;
};

export type GymStaffRoleSlice = {
  role: string;
  count: number;
};

export type GymPlanSlice = {
  plan: string;
  count: number;
};

export type GymJoinTrendPoint = {
  month: string;
  joins: number;
};

type CheckInRow = {
  outlet_id: string;
  checked_in_at: string;
};

type MembershipRow = {
  outlet_id: string;
  status: string;
  amount_paid: number | null;
  plan_id: string | null;
  joined_at: string | null;
};

type StaffRow = {
  outlet_id: string;
  role: string;
};

type BranchRow = {
  id: string;
  name: string;
};

type PlanRow = {
  id: string;
  name: string;
};

export type GymDashboardSnapshot = {
  branches: BranchRow[];
  memberships: MembershipRow[];
  staff: StaffRow[];
  /** Serializable plan id → name map (pass to client analytics panel). */
  planNames: Record<string, string>;
  checkIns: CheckInRow[];
};

export type GymDashboardBranchContext = {
  isMultiBranch: boolean;
  /** Primary or sole branch — used as default filter when multi-branch picker loads. */
  defaultBranchId: string | null;
  primaryBranchName: string | null;
  primaryBranchCity: string | null;
};

/** Shell + page copy that adapts to single vs multi-branch gyms. */
export function gymDashboardShellSubtitle(branchCount: number): string {
  if (branchCount > 1) {
    return "Track members, manage your team, and see how each branch is doing.";
  }
  return "Track members, manage your team, and keep your gym running smoothly.";
}

export function gymDashboardPageSubtitle(branchCount: number, branchName?: string | null): string {
  if (branchCount > 1) {
    return "Compare branches or pick one to drill into memberships, staff, and performance.";
  }
  if (branchName?.trim()) {
    return `Live numbers for memberships, staff, and performance at ${branchName.trim()}.`;
  }
  return "Live numbers for memberships, staff, and performance at your gym.";
}

export function resolveGymDashboardBranchContext(
  branches: { id: string; name: string; city?: string | null }[],
  primaryOutletId: string | null,
): GymDashboardBranchContext {
  const primary = branches.find((b) => b.id === primaryOutletId) ?? branches[0] ?? null;
  return {
    isMultiBranch: branches.length > 1,
    defaultBranchId: primary?.id ?? null,
    primaryBranchName: primary?.name ?? null,
    primaryBranchCity: primary?.city ?? null,
  };
}

/** Narrow snapshot to one or more outlets (for branch picker / single-branch default). */
export function filterGymDashboardSnapshot(
  snapshot: GymDashboardSnapshot,
  outletIds: string[],
): GymDashboardSnapshot {
  if (!outletIds.length) return snapshot;
  const idSet = new Set(outletIds);
  const allSelected = snapshot.branches.length > 0 && snapshot.branches.every((b) => idSet.has(b.id));
  if (allSelected && outletIds.length === snapshot.branches.length) return snapshot;

  return {
    branches: snapshot.branches.filter((b) => idSet.has(b.id)),
    memberships: snapshot.memberships.filter((m) => idSet.has(m.outlet_id)),
    staff: snapshot.staff.filter((s) => idSet.has(s.outlet_id)),
    planNames: snapshot.planNames,
    checkIns: snapshot.checkIns.filter((c) => idSet.has(c.outlet_id)),
  };
}

export async function loadGymDashboardSnapshot(
  supabase: SupabaseClient,
  outletIds: string[],
): Promise<GymDashboardSnapshot> {
  if (!outletIds.length) {
    return { branches: [], memberships: [], staff: [], planNames: {}, checkIns: [] };
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [{ data: branches }, { data: memberships }, { data: staff }, { data: checkIns }, { data: plans }] =
    await Promise.all([
      supabase
        .from("outlets")
        .select("id,name")
        .in("id", outletIds)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("gym_memberships")
        .select("outlet_id,status,amount_paid,plan_id,joined_at")
        .in("outlet_id", outletIds)
        .is("deleted_at", null),
      supabase
        .from("staff_assignments")
        .select("outlet_id,role")
        .in("outlet_id", outletIds)
        .is("revoked_at", null),
      supabase
        .from("check_ins")
        .select("outlet_id,checked_in_at")
        .in("outlet_id", outletIds)
        .gte("checked_in_at", sixMonthsAgo.toISOString()),
      supabase
        .from("membership_plans")
        .select("id,name")
        .in("outlet_id", outletIds)
        .is("deleted_at", null),
    ]);

  const planNames: Record<string, string> = {};
  for (const p of (plans ?? []) as PlanRow[]) {
    planNames[p.id] = p.name;
  }

  return {
    branches: (branches ?? []) as BranchRow[],
    memberships: (memberships ?? []) as MembershipRow[],
    staff: (staff ?? []) as StaffRow[],
    planNames,
    checkIns: (checkIns ?? []) as CheckInRow[],
  };
}

export function formatMembershipStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatStaffRoleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPayingMember(row: MembershipRow): boolean {
  return (row.amount_paid ?? 0) > 0 || row.plan_id != null;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/**
 * Serializable chart model for `GymDashboardCharts`.
 */
export function buildGymDashboardChartModel(snapshot: GymDashboardSnapshot): {
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
} {
  const { branches, memberships, staff, planNames, checkIns } = snapshot;

  const statusAcc = new Map<string, number>();
  const planAcc = new Map<string, number>();
  const membersByOutlet = new Map<string, number>();
  const payingByOutlet = new Map<string, number>();
  const staffByOutlet = new Map<string, number>();
  const staffRoleAcc = new Map<string, number>();
  const joinByMonth = new Map<string, number>();

  let payingMembers = 0;
  let activeMembers = 0;

  for (const m of memberships) {
    const statusLabel = formatMembershipStatusLabel(m.status);
    statusAcc.set(statusLabel, (statusAcc.get(statusLabel) ?? 0) + 1);
    membersByOutlet.set(m.outlet_id, (membersByOutlet.get(m.outlet_id) ?? 0) + 1);

    if (m.status === "active") activeMembers += 1;
    if (isPayingMember(m)) {
      payingMembers += 1;
      payingByOutlet.set(m.outlet_id, (payingByOutlet.get(m.outlet_id) ?? 0) + 1);
    }

    const planLabel = m.plan_id ? (planNames[m.plan_id] ?? "Assigned plan") : "No plan";
    planAcc.set(planLabel, (planAcc.get(planLabel) ?? 0) + 1);

    if (m.joined_at) {
      const key = monthKey(m.joined_at);
      joinByMonth.set(key, (joinByMonth.get(key) ?? 0) + 1);
    }
  }

  for (const s of staff) {
    staffByOutlet.set(s.outlet_id, (staffByOutlet.get(s.outlet_id) ?? 0) + 1);
    const roleLabel = formatStaffRoleLabel(s.role);
    staffRoleAcc.set(roleLabel, (staffRoleAcc.get(roleLabel) ?? 0) + 1);
  }

  const branchMetrics: GymBranchMetricRow[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    members: membersByOutlet.get(b.id) ?? 0,
    payingMembers: payingByOutlet.get(b.id) ?? 0,
    staff: staffByOutlet.get(b.id) ?? 0,
  }));

  const statusMix: GymStatusSlice[] = Array.from(statusAcc.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const staffRoles: GymStaffRoleSlice[] = Array.from(staffRoleAcc.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  const planMix: GymPlanSlice[] = Array.from(planAcc.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const joinTrend: GymJoinTrendPoint[] = Array.from(joinByMonth.entries())
    .map(([month, joins]) => ({ month, joins }))
    .slice(-8);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const checkInsLast30Days = checkIns.filter((c) => Date.parse(c.checked_in_at) >= thirtyDaysAgo).length;

  const branchCount = branches.length || 1;

  return {
    branchMetrics,
    statusMix,
    staffRoles,
    planMix,
    joinTrend,
    report: {
      totalCustomers: memberships.length,
      payingMembers,
      activeMembers,
      staffCount: staff.length,
      checkInsLast30Days,
      avgMembersPerBranch: memberships.length / branchCount,
    },
  };
}
