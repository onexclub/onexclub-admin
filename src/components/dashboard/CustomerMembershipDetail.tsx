"use client";

import { useActionState, type ReactNode } from "react";
import { MembershipAssignPlanPanel } from "@/components/admin/MembershipAssignPlanPanel";
import {
  assignTrainerToMembershipAction,
  suspendMembershipAction,
  updateCustomerProfileAction,
  type SimpleActionState,
} from "@/app/admin/customers/actions";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import type { UserRole } from "@/lib/auth/roles";
import {
  canEditCustomerProfileFields,
  canSuspendMembership,
  MEMBERSHIP_CATALOG_EDITOR_ROLES,
  ROLES,
} from "@/lib/auth/roles";

/** Row shape shared with `/dashboard/customers` list + membership detail page. */
export type CustomerMembershipDetailMembership = {
  id: string;
  status: string;
  outlet_id: string;
  profile_id: string;
  assigned_trainer_id: string | null;
  joined_at: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_paid: number | null;
  currency: string | null;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  outlet: { name: string | null; city: string | null } | null;
  plan: { id: string; name: string } | null;
};

type TrainerLite = { id: string; full_name: string | null; email: string | null };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {description ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function readableStatus(status: string): string {
  const map: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    expired: "Expired",
    pending: "Pending",
  };
  return map[status] ?? status;
}

/**
 * Full-page layout for one membership: readable sections + role-gated edit forms.
 *
 * **Reuse:** permission checks stay aligned with `@/lib/auth/roles`; each block maps to the same server actions as the old inline row menu.
 */
export function CustomerMembershipDetail(props: {
  membership: CustomerMembershipDetailMembership;
  catalogue: MembershipPlanAdminRow[];
  defaultStartDate: string;
  ctxRole: UserRole;
  trainers: TrainerLite[];
  canAssignPlan: boolean;
  canAssignTrainer: boolean;
}) {
  const {
    membership,
    catalogue,
    defaultStartDate,
    ctxRole,
    trainers,
    canAssignPlan,
    canAssignTrainer,
  } = props;

  const [suspendState, suspendAction, suspendPending] = useActionState(suspendMembershipAction, {} as SimpleActionState);
  const [trainerState, trainerAction, trainerPending] = useActionState(assignTrainerToMembershipAction, {} as SimpleActionState);
  const [profileState, profileAction, profilePending] = useActionState(updateCustomerProfileAction, {} as SimpleActionState);

  const outletLabel = [membership.outlet?.name, membership.outlet?.city].filter(Boolean).join(" · ");
  const displayName =
    membership.profile?.full_name || membership.profile?.email || "This member";

  const showTechnicalPlanIds = MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctxRole as never);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{displayName}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{membership.profile?.email ?? "No email on file"}</p>
      </div>

      <Section title="Overview" description="What this member has today — dates and branch.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Branch</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{outletLabel || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Pass status</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{readableStatus(membership.status)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Plan on file</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{membership.plan?.name ?? "None selected"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current term</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
              {membership.start_date ?? "—"} → {membership.end_date ?? "Open-ended"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Joined</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
              {membership.joined_at ? new Date(membership.joined_at).toLocaleDateString() : "—"}
            </dd>
          </div>
          {membership.amount_paid != null ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Last logged payment</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
                {(membership.currency ?? "INR").toUpperCase()} {membership.amount_paid.toLocaleString()}
              </dd>
            </div>
          ) : null}
        </dl>
        {showTechnicalPlanIds && membership.plan ? (
          <p className="mt-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">Internal plan ID: {membership.plan.id}</p>
        ) : null}
      </Section>

      {canAssignPlan ? (
        <Section
          title="Membership plan"
          description="Renew a pass or attach a catalogue plan after payment. Inactive memberships get fresh dates automatically when you attach a paid plan."
        >
          <MembershipAssignPlanPanel
            membershipId={membership.id}
            outletDisplay={outletLabel.length ? outletLabel : membership.outlet_id}
            status={membership.status}
            profileLabel={displayName}
            plans={catalogue}
            defaultStartDate={defaultStartDate}
          />
        </Section>
      ) : (
        ctxRole === ROLES.TRAINER ? (
          <Section title="Membership plan">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Coaches can train assigned members; changing plans stays with front desk and branch leads.
            </p>
          </Section>
        ) : null
      )}

      {canAssignTrainer ? (
        <Section title="Coach" description="Pick who trains this member on your team. Leave empty if no-one is assigned yet.">
          <form action={trainerAction} className="space-y-3">
            <input type="hidden" name="membership_id" value={membership.id} />
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Trainer
              <select
                name="trainer_profile_id"
                defaultValue={membership.assigned_trainer_id ?? ""}
                className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">Not assigned</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name ?? t.email ?? t.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={trainerPending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {trainerPending ? "Saving…" : "Save coach"}
            </button>
            {trainerState.error ? <p className="text-sm text-rose-600">{trainerState.error}</p> : null}
            {trainerState.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{trainerState.success}</p> : null}
          </form>
        </Section>
      ) : null}

      {canEditCustomerProfileFields(ctxRole) ? (
        <Section title="Contact details" description="Name and phone shown to your team and on member touchpoints.">
          <form action={profileAction} className="space-y-3">
            <input type="hidden" name="profile_id" value={membership.profile_id} />
            <input type="hidden" name="membership_outlet_id" value={membership.outlet_id} />
            <input type="hidden" name="membership_id_for_revalidate" value={membership.id} />
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Full name
              <input
                name="full_name"
                defaultValue={membership.profile?.full_name ?? ""}
                className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Phone
              <input
                name="phone"
                defaultValue={membership.profile?.phone ?? ""}
                className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <button
              type="submit"
              disabled={profilePending}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
            >
              {profilePending ? "Saving…" : "Save contact details"}
            </button>
            {profileState.error ? <p className="text-sm text-rose-600">{profileState.error}</p> : null}
            {profileState.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{profileState.success}</p> : null}
          </form>
        </Section>
      ) : null}

      {canSuspendMembership(ctxRole) ? (
        <Section title="Account status" description="Suspending blocks check-ins and access until you resolve it with the member.">
          <form action={suspendAction} className="space-y-2">
            <input type="hidden" name="membership_id" value={membership.id} />
            <button
              disabled={suspendPending || membership.status === "suspended"}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
            >
              {suspendPending ? "Working…" : "Suspend this membership"}
            </button>
            {suspendState.error ? <p className="text-sm text-rose-600">{suspendState.error}</p> : null}
            {suspendState.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{suspendState.success}</p> : null}
          </form>
        </Section>
      ) : null}
    </div>
  );
}
