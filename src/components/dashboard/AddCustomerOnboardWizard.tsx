"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  onboardMemberWizardAction,
  type OnboardMemberWizardState,
} from "@/app/admin/members/onboard/actions";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import type { UserRole } from "@/lib/auth/roles";
import { OnboardingQuestionnairePanel } from "@/features/onboarding/components/OnboardingQuestionnairePanel";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import Link from "next/link";
import { ROUTES } from "@/utils/routes";

type OutletOption = { id: string; name: string; city: string | null };

const initialWizard: OnboardMemberWizardState = {};

const selectCn =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

/**
 * Combined “Add customer” flow — member record + collapsed questionnaire sections (`question_definitions`).
 *
 * **Moderation:** hydrate from `/dashboard/customers/onboard` and `/admin/members/onboard`; share `fetchMembershipPlansForOutlets`.
 */
export function AddCustomerOnboardWizard(props: {
  outlets: OutletOption[];
  plans: MembershipPlanAdminRow[];
  defaultStartDate: string;
  actorProfileId: string;
  ctxRole: UserRole;
}) {
  const { outlets, plans: allPlans, defaultStartDate, actorProfileId, ctxRole } = props;
  const [state, formAction, pending] = useActionState(onboardMemberWizardAction, initialWizard);
  const [outletId, setOutletId] = useState<string>(() => outlets[0]?.id ?? "");
  /** Local step latch so revisiting preserves step 2 after action returns IDs. */
  const [revealedMembership, setRevealedMembership] = useState<{
    membershipId: string;
    profileId: string;
    outletId: string;
  } | null>(null);

  useEffect(() => {
    if (state.membershipId && state.profileId && state.outletId) {
      setRevealedMembership({
        membershipId: state.membershipId,
        profileId: state.profileId,
        outletId: state.outletId,
      });
    }
  }, [state.membershipId, state.profileId, state.outletId]);

  const visiblePlans = useMemo(
    () => allPlans.filter((p) => p.outlet_id === outletId && p.is_active),
    [allPlans, outletId],
  );

  const effectiveViewer: OnboardingViewerContext | null = revealedMembership
    ? {
        role: ctxRole,
        profileId: revealedMembership.profileId,
        outletId: revealedMembership.outletId,
        membershipId: revealedMembership.membershipId,
        actorProfileId,
        isCustomerActor: false,
      }
    : null;

  if (revealedMembership && effectiveViewer) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-emerald-700/35 bg-emerald-950/30 px-5 py-4 text-sm text-emerald-50">
          <p className="font-semibold text-emerald-50">Member created.</p>
          <p className="mt-1 text-emerald-100/85">
            Complete the questionnaires below — you can revisit them later from the customer roster or membership detail tabs.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Link
              className="font-semibold text-orange-400 hover:underline"
              href={`${ROUTES.dashboardCustomers}?refresh=1`}
            >
              Back to dashboard customers list
            </Link>
          </div>
        </div>
        <OnboardingQuestionnairePanel viewer={effectiveViewer} outletId={revealedMembership.outletId} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Outlet
        <select
          name="outlet_id"
          required
          value={outletId}
          onChange={(e) => setOutletId(e.target.value)}
          className={selectCn}
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.city ? ` — ${o.city}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Membership plan (optional — assign offline payment after creating plans)
        <select name="plan_id" className={selectCn}>
          <option value="">Defer — no catalogue row attached yet</option>
          {visiblePlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {(p.currency || "INR").toUpperCase()} {p.price.toLocaleString()} / {p.billing_cycle}
              {typeof p.duration_days === "number" ? ` • ${p.duration_days}-day term hint` : " • open term"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Membership start date (`YYYY-MM-DD`)
        <input name="start_date" type="date" defaultValue={defaultStartDate} required className={selectCn} />
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input name="record_offline_payment" type="checkbox" />
        Offline payment logged now (copies catalogue price into amount_paid)
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Full name
        <input name="full_name" className={selectCn} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Email
        <input name="email" type="email" required className={selectCn} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Temporary password
        <input name="password" type="password" required minLength={8} className={selectCn} />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create member & continue"}
      </button>
    </form>
  );
}
