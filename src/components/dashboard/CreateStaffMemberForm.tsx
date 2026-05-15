"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaffMemberAction, type StaffActionState } from "@/app/dashboard/staff/actions";
import { StaffAvatar } from "@/components/dashboard/StaffAvatar";
import { ASSIGNABLE_ROLES, ROLE_META, type UserRole } from "@/lib/auth/roles";
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
 * **Reuse:** Mirrors `AddCustomerOnboardWizard` Auth pattern without invite emails.
 */
export function CreateStaffMemberForm({ outlets }: { outlets: OutletOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStaffMemberAction, INITIAL);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");

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
            Phone
            <input name="phone" type="tel" className={fieldClass} placeholder="+91 …" />
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

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Branch & role</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Branch
            <select name="outlet_id" required className={fieldClass} defaultValue={outlets[0]?.id}>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name ?? o.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Role
            <select name="role" required className={fieldClass} defaultValue="receptionist">
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r as UserRole].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:col-span-2">
            <input type="checkbox" name="is_primary" defaultChecked className="size-4 rounded border-zinc-300" />
            Main branch assignment
          </label>
        </div>
      </section>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-orange-600 px-6 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-70"
      >
        {pending ? "Creating…" : "Create team member"}
      </button>
    </form>
  );
}
