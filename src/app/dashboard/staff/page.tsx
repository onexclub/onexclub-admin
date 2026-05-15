import Link from "next/link";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { StaffAssignmentRowActions } from "@/components/dashboard/StaffAssignmentRowActions";
import { StaffAvatar } from "@/components/dashboard/StaffAvatar";
import { StaffListFlash } from "@/components/dashboard/StaffListFlash";
import { StaffRosterFilters } from "@/components/dashboard/StaffRosterFilters";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  STAFF_ROSTER_SELECT,
  fetchStaffProfilesByIds,
  resolveStaffRosterProfile,
  staffOutletFromRow,
  type StaffRosterRow,
} from "@/lib/admin/staff-roster";
import type { DashboardFeature } from "@/lib/auth/roles";
import { ASSIGNABLE_ROLES, canManageStaffAssignments, ROLE_META, ROLES, type UserRole } from "@/lib/auth/roles";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES, dashboardStaffAssignmentPath } from "@/utils/routes";

const FEATURE: DashboardFeature = "staff";

type OutletOption = { id: string; name: string | null };

/**
 * Staff roster (`staff_assignments`) for `/dashboard/staff`.
 *
 * **Reuse:** row shape + profile resolution live in `@/lib/admin/staff-roster.ts`.
 */
export default async function DashboardStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; outlet?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = effectiveManagedOutletIds(ctx);
  const q = (sp.q ?? "").trim().toLowerCase();
  const outletFilter = (sp.outlet ?? "").trim();
  const roleFilter = (sp.role ?? "").trim();

  let outlets: OutletOption[] = [];
  if (outletIds.length) {
    const { data } = await supabase
      .from("outlets")
      .select("id,name,city")
      .in("id", outletIds)
      .is("deleted_at", null)
      .order("name");
    outlets = ((data ?? []) as { id: string; name: string | null; city: string | null }[]).map((o) => ({
      id: o.id,
      name: o.city?.length ? `${o.name ?? "Branch"} · ${o.city}` : (o.name ?? "Branch"),
    }));
  }

  let query = outletIds.length
    ? supabase
        .from("staff_assignments")
        .select(STAFF_ROSTER_SELECT)
        .in("outlet_id", outletIds)
        .is("revoked_at", null)
        .neq("role", ROLES.GYM_OWNER)
        .order("assigned_at", { ascending: false })
    : null;

  if (query && outletFilter && outletIds.includes(outletFilter)) {
    query = query.eq("outlet_id", outletFilter);
  }
  if (query && roleFilter && (ASSIGNABLE_ROLES as readonly string[]).includes(roleFilter)) {
    query = query.eq("role", roleFilter);
  }

  const { data: rows, error } = query ? await query : { data: [], error: null };

  let sanitizedRows = (error || !rows?.length ? [] : rows) as unknown as StaffRosterRow[];

  const profileById =
    sanitizedRows.length > 0
      ? await fetchStaffProfilesByIds(
          createServiceRoleSupabaseClient(),
          sanitizedRows.map((r) => r.profile_id),
        )
      : new Map();

  if (q.length) {
    sanitizedRows = sanitizedRows.filter((row) => {
      const profile = resolveStaffRosterProfile(row, profileById);
      const hay = `${profile?.full_name ?? ""} ${profile?.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const canInvite = canManageStaffAssignments(ctx.appRole);
  const canMutateOwners = ctx.appRole === ROLES.SUPERADMIN || ctx.appRole === ROLES.GYM_OWNER;
  const hasActiveFilters = Boolean(q || outletFilter || roleFilter);

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Team</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              People who work at your branches — reception, coaches, and branch admins. Gym owners aren’t duplicated in this list.
            </p>
          </div>
          {canInvite ? (
            <RoleGuard role={ctx.appRole} feature={FEATURE} requireWrite>
              <Link
                href={ROUTES.dashboardStaffNew}
                className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-700"
              >
                Add team member
              </Link>
            </RoleGuard>
          ) : null}
        </div>

        {!outletIds.length ? (
          <EmptyState
            title="No branches linked yet"
            description="Once your organisation has an outlet assigned to you in the dashboard, your team roster will load here."
          />
        ) : (
          <>
            <Suspense fallback={null}>
              <StaffListFlash />
            </Suspense>

            <Suspense fallback={<p className="text-sm text-zinc-500">Loading filters…</p>}>
              <StaffRosterFilters
                outlets={outlets}
                initialQ={sp.q ?? ""}
                initialOutlet={outletFilter}
                initialRole={roleFilter}
              />
            </Suspense>

            {!canInvite ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Branch admins can view the roster here. Adding or changing teammates is handled by gym owners.
              </p>
            ) : null}

            {error ? (
              <EmptyState title="Couldn't load roster" description={error.message} />
            ) : !sanitizedRows.length ? (
              <EmptyState
                title={hasActiveFilters ? "No matches" : canInvite ? "No teammates listed yet" : "No teammates to show"}
                description={
                  hasActiveFilters
                    ? "Try clearing filters or broadening your search."
                    : canInvite
                      ? "Add your first receptionist, trainer, or branch admin."
                      : "Your gym hasn’t added branch staff rows you can view yet."
                }
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Team member</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Branch</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {sanitizedRows.map((row) => {
                      const profile = resolveStaffRosterProfile(row, profileById);
                      const outlet = staffOutletFromRow(row);
                      const roleKey = row.role as UserRole;
                      const roleLabel = ROLE_META[roleKey]?.label ?? row.role.replace(/_/g, " ");
                      const statusVariant = row.invite_pending ? "warning" : "success";
                      const statusLabel = row.invite_pending ? "Invite pending" : "Active";
                      const detailHref = dashboardStaffAssignmentPath(row.id);
                      const displayName = profile?.full_name?.trim() || profile?.email || "Unnamed";

                      return (
                        <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                          <td className="px-4 py-3">
                            <Link href={detailHref} className="flex items-center gap-3 group">
                              <StaffAvatar
                                avatarUrl={profile?.avatar_url}
                                fullName={profile?.full_name}
                                email={profile?.email}
                                size="sm"
                              />
                              <span>
                                <span className="font-semibold text-zinc-900 group-hover:text-orange-600 dark:text-zinc-50 dark:group-hover:text-orange-400">
                                  {displayName}
                                </span>
                                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                                  {profile?.email ?? "—"}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">{roleLabel}</td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {outlet?.name ?? row.outlet_id}
                            {outlet?.city ? ` · ${outlet.city}` : ""}
                            {row.is_primary ? (
                              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                Primary
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <StaffAssignmentRowActions assignmentId={row.id} canManage={canMutateOwners} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}
