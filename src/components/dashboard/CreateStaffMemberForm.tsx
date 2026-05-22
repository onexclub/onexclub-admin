"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffMemberAction, type StaffActionState } from "@/app/dashboard/staff/actions";
import { StaffAvatar } from "@/components/dashboard/StaffAvatar";
import { StaffBranchPickerFields } from "@/components/dashboard/StaffBranchPickerFields";
import { ASSIGNABLE_ROLES, ROLE_META, ROLES, type AssignableStaffRole, type UserRole } from "@/lib/auth/roles";
import {
  isStaffPhoneRequiredForProvisioning,
  staffProvisioningPhoneHint,
} from "@/lib/auth/role-sign-in-policy";
import { ROUTES } from "@/utils/routes";

type OutletOption = { id: string; name: string | null };

const INITIAL: StaffActionState = {};

function randomTempPassword(): string {
  const chunk = () => Math.random().toString(36).slice(2, 6);
  return `Fit${chunk()}${chunk()}!`;
}

const fieldClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

/**
 * Add-teammate form (`/dashboard/staff/new`) — password provisioning, optional photo.
 *
 * **Reuse:** Mirrors `AddCustomerOnboardWizard` provisioning pattern without invite emails.
 * Branch picker: `StaffBranchPickerFields` + `parseStaffBranchFormSelection` (same as detail page edit).
 * Phone rules mirror `src/lib/auth/role-sign-in-policy.ts` (also documented in `docs/auth-by-role.md`).
 */
export function CreateStaffMemberForm({ outlets }: { outlets: OutletOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStaffMemberAction, INITIAL);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableStaffRole>(ROLES.RECEPTIONIST);
  const [branchSelectionValid, setBranchSelectionValid] = useState(true);
  const phoneRequired = isStaffPhoneRequiredForProvisioning(role);

  const suggestedPassword = useMemo(() => randomTempPassword(), []);

  useEffect(() => {
    if (state.success) {
      router.push(`${ROUTES.dashboardStaff}?toast=staff-created`);
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={action} className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Photo</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Optional — shown in the roster and profile.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <StaffAvatar avatarUrl={previewUrl} fullName={null} email={null} size="lg" />
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Upload
            <input
              type="file"
              name="avatar"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="max-w-xs text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-800 dark:text-zinc-400 dark:file:bg-orange-950/40 dark:file:text-orange-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setPreviewUrl(null);
                  return;
                }
                setPreviewUrl(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Branch & role</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pick the role first — phone becomes required for reception and trainer. You can assign one branch or several
          (e.g. a branch admin for all locations).
        </p>
        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Role
            <select
              name="role"
              required
              className={fieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value as AssignableStaffRole)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r as UserRole].label}
                </option>
              ))}
            </select>
          </label>
          <StaffBranchPickerFields
            outlets={outlets}
            defaultOutletId={outlets[0]?.id}
            onValidChange={setBranchSelectionValid}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Full name
            <input required name="full_name" className={fieldClass} placeholder="Full name" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Work email
            <input required name="email" type="email" className={fieldClass} placeholder="name@example.com" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
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
              className={fieldClass}
              placeholder="+91 …"
              aria-required={phoneRequired}
            />
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {staffProvisioningPhoneHint(role)}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Temporary password
            <div className="flex flex-wrap gap-2">
              <input
                name="password"
                type="text"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`min-w-[14rem] flex-1 ${fieldClass}`}
                placeholder="At least 8 characters (new accounts)"
              />
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
                onClick={() => setPassword(suggestedPassword)}
              >
                Suggest password
              </button>
            </div>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              Share this securely. They can change it after signing in.
            </span>
          </label>
        </div>
      </section>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending || !branchSelectionValid}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-orange-600 px-6 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-70"
      >
        {pending ? "Creating…" : "Create team member"}
      </button>
    </form>
  );
}
