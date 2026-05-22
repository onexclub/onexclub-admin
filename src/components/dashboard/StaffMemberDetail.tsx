"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { revokeStaffAssignmentAction, updateStaffProfileAction, type StaffActionState } from "@/app/dashboard/staff/actions";
import { StaffAvatar } from "@/components/dashboard/StaffAvatar";
import { StaffBranchAccessSection } from "@/components/dashboard/StaffBranchAccessSection";
import type { StaffBranchAssignmentRow } from "@/lib/admin/staff-branch-assignments";
import { Badge } from "@/components/ui/badge";
import { ASSIGNABLE_ROLES, ROLE_META, type AssignableStaffRole, type UserRole } from "@/lib/auth/roles";
import { isStaffPhoneRequiredForProvisioning, staffProvisioningPhoneHint } from "@/lib/auth/role-sign-in-policy";
import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";
import { ROUTES } from "@/utils/routes";

type OutletOption = { id: string; name: string | null };

export type StaffMemberDetailRow = {
  assignmentId: string;
  outletId: string;
  role: string;
  isPrimary: boolean;
  invitePending: boolean;
  assignedAt: string | null;
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
  outlet: { name: string | null; city: string | null } | null;
};

const fieldClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {description ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Staff profile + inline edit (`?edit=1` on `/dashboard/staff/[id]`).
 *
 * **Reuse:** Assignment mutations use the same server actions as the legacy inline row forms.
 */
export function StaffMemberDetail({
  row,
  outlets,
  branchAssignments,
  canManage,
  initialEdit,
}: {
  row: StaffMemberDetailRow;
  outlets: OutletOption[];
  branchAssignments: StaffBranchAssignmentRow[];
  canManage: boolean;
  initialEdit: boolean;
}) {
  const [editing, setEditing] = useState(initialEdit);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [profileState, profileAction, profilePending] = useActionState(updateStaffProfileAction, {} as StaffActionState);

  const roleKey = row.role as UserRole;
  const roleSlugs = ASSIGNABLE_ROLES as readonly string[];
  const isAssignableStaff = roleSlugs.includes(row.role);
  const phoneRequired =
    isAssignableStaff && isStaffPhoneRequiredForProvisioning(row.role as AssignableStaffRole);
  const roleLabel = ROLE_META[roleKey]?.label ?? row.role.replace(/_/g, " ");
  const outletLabel = [row.outlet?.name, row.outlet?.city].filter(Boolean).join(" · ");
  const outletNameById = Object.fromEntries(outlets.map((o) => [o.id, o.name ?? o.id]));
  const branchLabels =
    branchAssignments.length > 1
      ? branchAssignments.map((a) => outletNameById[a.outletId] ?? a.outletId).join(", ")
      : outletLabel || row.outletId;
  const displayName = row.profile.fullName || row.profile.email || "Team member";
  const statusVariant = row.invitePending ? "warning" : "success";
  const statusLabel = row.invitePending ? "Invite pending" : "Active";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <StaffAvatar
            avatarUrl={avatarPreview ?? row.profile.avatarUrl}
            fullName={row.profile.fullName}
            email={row.profile.email}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{row.profile.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <Badge variant="outline">{roleLabel}</Badge>
              {row.isPrimary ? <Badge variant="default">Primary branch</Badge> : null}
              {branchAssignments.length > 1 ? (
                <Badge variant="outline">{branchAssignments.length} branches</Badge>
              ) : null}
            </div>
          </div>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {editing ? "Cancel editing" : "Edit profile"}
          </button>
        ) : null}
      </div>

      {!editing ? (
        <>
          <Section title="Contact">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Phone</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{row.profile.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{row.profile.email ?? "—"}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Assignment">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className={branchAssignments.length > 1 ? "sm:col-span-2" : undefined}>
                <dt className="text-zinc-500 dark:text-zinc-400">
                  {branchAssignments.length > 1 ? "Branches" : "Branch"}
                </dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{branchLabels}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Joined</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatMembershipTimestampUtcLabel(row.assignedAt)}
                </dd>
              </div>
            </dl>
          </Section>
        </>
      ) : (
        <>
          <Section title="Profile" description="Name, phone, and photo appear in the roster.">
            <form action={profileAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="assignment_id" value={row.assignmentId} />
              <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
                Photo
                <input
                  type="file"
                  name="avatar"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-800"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setAvatarPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Full name
                <input name="full_name" defaultValue={row.profile.fullName ?? ""} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                <span>
                  Phone
                  {phoneRequired ? (
                    <span className="ml-1 font-semibold text-rose-600 dark:text-rose-400" aria-hidden>
                      *
                    </span>
                  ) : null}
                </span>
                <input
                  name="phone"
                  type="tel"
                  required={phoneRequired}
                  defaultValue={row.profile.phone ?? ""}
                  className={fieldClass}
                  aria-required={phoneRequired}
                />
                {isAssignableStaff ? (
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {staffProvisioningPhoneHint(row.role as AssignableStaffRole)}
                  </span>
                ) : null}
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={profilePending}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-70"
                >
                  {profilePending ? "Saving…" : "Save profile"}
                </button>
                {profileState.error ? <p className="mt-2 text-sm text-rose-600">{profileState.error}</p> : null}
                {profileState.success ? (
                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{profileState.success}</p>
                ) : null}
              </div>
            </form>
          </Section>

          <StaffBranchAccessSection
            assignmentId={row.assignmentId}
            currentOutletId={row.outletId}
            role={row.role}
            outlets={outlets}
            branchAssignments={branchAssignments}
          />

          <Section title="Remove access" description="Soft-revokes this branch assignment. History is kept for audits.">
            <form action={revokeStaffAssignmentAction}>
              <input type="hidden" name="assignment_id" value={row.assignmentId} />
              <button
                type="submit"
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-200"
              >
                Remove from branch
              </button>
            </form>
          </Section>
        </>
      )}

      <p className="text-sm">
        <Link href={ROUTES.dashboardStaff} className="font-semibold text-orange-600 hover:underline dark:text-orange-400">
          ← Back to team
        </Link>
      </p>
    </div>
  );
}
