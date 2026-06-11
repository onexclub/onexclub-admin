"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfileAction, type MyProfileActionState } from "@/app/dashboard/profile/actions";
import { StaffAvatar } from "@/components/dashboard/StaffAvatar";
import { IndiaPhoneInput } from "@/components/dashboard/IndiaPhoneInput";
import { SignOutButton } from "@/components/layout/SignOutButton";
import type { CurrentUserProfilePageData } from "@/lib/account/current-user-profile";
import { ROUTES } from "@/utils/routes";

const initial: MyProfileActionState = {};

type Props = {
  profile: CurrentUserProfilePageData;
};

/**
 * Signed-in account view — role, branch access, and editable name / phone / photo.
 *
 * **Reuse:** rendered from `/dashboard/profile`; header chip links here from all dashboard shells.
 */
export function MyProfilePanel({ profile }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState(profile.phone ?? "");
  const [state, formAction, pending] = useActionState(updateMyProfileAction, initial);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      setEditing(false);
    }
  }, [router, state.success]);

  const displayName = profile.fullName?.trim() || profile.email;
  const memberSince = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <StaffAvatar
              avatarUrl={profile.avatarUrl}
              fullName={profile.fullName}
              email={profile.email}
              size="lg"
            />
            <div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{profile.email}</p>
              <span className="mt-3 inline-flex rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-800 dark:text-orange-200">
                {profile.roleLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {editing ? "Cancel" : "Edit profile"}
          </button>
        </div>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{profile.roleDescription}</p>

        {profile.gymName ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Gym: <span className="font-medium text-zinc-800 dark:text-zinc-200">{profile.gymName}</span>
          </p>
        ) : null}

        {memberSince ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Member since {memberSince}</p>
        ) : null}
      </div>

      {editing ? (
        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit your details</h4>

          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Profile photo
            <input
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="mt-1.5 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-700 dark:text-zinc-400"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Full name
            <input
              name="full_name"
              defaultValue={profile.fullName ?? ""}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 outline-none ring-orange-500/25 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>

          <IndiaPhoneInput
            label="Mobile number"
            labelClassName="text-sm font-medium text-zinc-800 dark:text-zinc-100"
            value={phoneLocal}
            onChange={setPhoneLocal}
            inputClassName="w-full border-0 bg-transparent px-3 py-2.5 text-zinc-900 outline-none dark:text-zinc-50"
          />
          <input type="hidden" name="phone" value={phoneLocal} />

          {state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
              {state.success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Contact</h4>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mobile</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{profile.phone ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      {profile.branchAssignments.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Branch access</h4>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Branches and roles linked to your account.
          </p>
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {profile.branchAssignments.map((row) => (
              <li key={`${row.outletId}-${row.role}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {row.outletName}
                    {row.isPrimary ? (
                      <span className="ml-2 text-xs font-normal text-orange-600 dark:text-orange-400">Primary</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{row.city?.trim() || "—"}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {row.roleLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Account &amp; security</h4>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage your password or sign out of this device.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={ROUTES.authUpdatePassword}
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Change password
          </Link>
          <SignOutButton shellTheme="superadmin" />
        </div>
      </div>
    </div>
  );
}
