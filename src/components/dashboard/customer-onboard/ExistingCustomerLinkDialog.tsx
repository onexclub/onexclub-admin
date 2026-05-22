"use client";

import { useMemo } from "react";
import { UserRound, X } from "lucide-react";
import { BMI_BAND_LABEL, classifyBmi } from "@/lib/customers/bmi-band";
import {
  sameBranchMembershipNotices,
  sameOrganizationMembershipNotices,
  type ExistingCustomerMatch,
} from "@/lib/customers/customer-lookup";
import { genderLabel } from "@/lib/profile/vitals";
import { Button } from "@/components/ui/button";

type StaffOutletLite = { id: string; name: string; organization_name: string | null };

/**
 * Shown on Identity step when `find_existing_customer` returns a match.
 * Same-branch: clear “already onboarded here” message; still allows continue to update details.
 *
 * **Reuse:** onboarding wizard only — profile edit uses inline errors (`customer-lookup.ts`).
 */
export function ExistingCustomerLinkDialog(props: {
  open: boolean;
  customer: ExistingCustomerMatch | null;
  staffOrganizationIds: string[];
  staffOutlets: StaffOutletLite[];
  pending?: boolean;
  onConfirmLink: () => void;
  onDifferentPerson: () => void;
  onClose: () => void;
}) {
  const { open, customer, staffOrganizationIds, staffOutlets, pending, onConfirmLink, onDifferentPerson, onClose } =
    props;

  const staffOutletIds = useMemo(() => staffOutlets.map((o) => o.id), [staffOutlets]);

  const sameBranchLinks = useMemo(() => {
    if (!customer) return [];
    return sameBranchMembershipNotices(customer.gym_history, staffOutletIds);
  }, [customer, staffOutletIds]);

  const sameOrgOnlyLinks = useMemo(() => {
    if (!customer) return [];
    const branchIds = new Set(sameBranchLinks.map((l) => l.outletId));
    return sameOrganizationMembershipNotices(customer.gym_history, staffOrganizationIds).filter(
      (l) => !branchIds.has(l.outletId),
    );
  }, [customer, staffOrganizationIds, sameBranchLinks]);

  if (!open || !customer) return null;

  const bmiBand = classifyBmi(customer.bmi);
  const displayName = customer.full_name?.trim() || "Existing member";
  const initial = displayName.charAt(0).toUpperCase();

  const hasSameBranch = sameBranchLinks.length > 0;
  const hasSameOrg = sameOrgOnlyLinks.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="existing-customer-dialog-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
            Member found
          </p>
          <h2 id="existing-customer-dialog-title" className="mt-1 pr-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {hasSameBranch ? "Already onboarded at your branch" : hasSameOrg ? "Already at your gym" : "Add them to your branch?"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {hasSameBranch
              ? "This customer is already in your system at the branch below. Continue to review and update their details — you won't create a duplicate account."
              : hasSameOrg
                ? "They belong to your gym at another branch. Continue to add or update them at your selected branch."
                : "This person is already a OneX Club member. Load their profile to register them at your branch."}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex gap-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
              {initial ? (
                <span className="text-lg font-bold">{initial}</span>
              ) : (
                <UserRound className="size-6" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</p>
              {customer.phone ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{customer.phone}</p>
              ) : null}
              {customer.email ? (
                <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{customer.email}</p>
              ) : null}
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                {customer.bmi != null ? `BMI ${customer.bmi.toFixed(1)}` : "BMI —"}
                {bmiBand ? ` · ${BMI_BAND_LABEL[bmiBand]}` : ""}
                {customer.gender ? ` · ${genderLabel(customer.gender)}` : ""}
              </p>
            </div>
          </div>

          {hasSameBranch ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
              {sameBranchLinks.map((link) => (
                <p key={link.outletId} className="text-sm leading-relaxed text-amber-950 dark:text-amber-100">
                  <span className="font-semibold">{displayName.split(" ")[0] || "This customer"}</span> is already
                  added to{" "}
                  <span className="font-semibold">{link.organizationName}</span>
                  {" · "}
                  <span className="font-semibold">{link.branchName}</span>
                  {link.isActive ? (
                    <span> with an active membership.</span>
                  ) : (
                    <span className="capitalize"> (membership {link.status}).</span>
                  )}{" "}
                  You can still continue to update their profile and membership details.
                </p>
              ))}
            </div>
          ) : hasSameOrg ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
              {sameOrgOnlyLinks.map((link) => (
                <p key={link.outletId} className="text-sm text-amber-950 dark:text-amber-100">
                  On file at your gym&apos;s <span className="font-semibold">{link.branchName}</span> branch
                  {link.isActive ? " (active)" : ` (${link.status})`}.
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-6 py-4 sm:flex-row sm:justify-end dark:border-zinc-800">
          <Button type="button" variant="outline" onClick={onDifferentPerson} disabled={pending}>
            Not this person
          </Button>
          <Button type="button" onClick={onConfirmLink} disabled={pending}>
            {pending ? "Loading profile…" : hasSameBranch ? "Continue — update details" : "Load profile & review"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Banner copy when staff picks a branch where the member is already onboarded (Membership step). */
export function SameBranchOnboardBanner(props: {
  branchName: string;
  organizationName: string;
  isActive: boolean;
  status: string;
}) {
  const { branchName, organizationName, isActive, status } = props;
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      This customer is already onboarded at{" "}
      <span className="font-semibold">{organizationName}</span>
      {" · "}
      <span className="font-semibold">{branchName}</span>
      {isActive ? (
        <span> with an active pass.</span>
      ) : (
        <span className="capitalize"> ({status} membership).</span>
      )}{" "}
      Continue to update their details or adjust plan and dates below.
    </p>
  );
}
