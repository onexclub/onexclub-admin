"use client";

import { useActionState } from "react";
import {
  onboardGymAction,
  type OnboardGymFieldErrors,
  type OnboardGymState,
} from "@/app/superadmin/onboard/actions";

const initial: OnboardGymState = {};

/** Shared input styling; red border when server returned `fieldErrors` for this `name`. */
function controlClasses(hasError: boolean) {
  return [
    "w-full rounded-lg border bg-white px-3 py-2 text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-50",
    hasError
      ? "border-red-500 ring-red-500/40 focus:border-red-600 focus:ring-4 dark:border-red-500"
      : "border-zinc-300 ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700",
  ].join(" ");
}

function InlineFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
      {message}
    </span>
  );
}

export function OnboardGymForm() {
  const [state, formAction, pending] = useActionState(onboardGymAction, initial);

  /**
   * Reuse / moderation: onboarding action returns `{ recoveryKey, values, fieldErrors? }` on failure.
   * `key={recoveryKey}` forces a remount so `defaultValue` repopulates after submit — without this,
   * React + Server Actions completion tends to wipe uncontrolled fields even when returning an error.
   */
  const v = state.values;
  const fe = state.fieldErrors as OnboardGymFieldErrors | undefined;

  return (
    <form
      key={state.recoveryKey ?? "onboard-gym-initial"}
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Organization name
          <input
            name="organization_name"
            required
            defaultValue={v?.organization_name}
            aria-invalid={Boolean(fe?.organization_name)}
            aria-describedby={fe?.organization_name ? "err-organization-name" : undefined}
            className={controlClasses(Boolean(fe?.organization_name))}
          />
          {fe?.organization_name ? (
            <p id="err-organization-name">
              <InlineFieldError message={fe.organization_name} />
            </p>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Slug (optional)
          <input
            name="slug"
            placeholder="auto-generated from name"
            defaultValue={v?.slug}
            aria-invalid={Boolean(fe?.slug)}
            aria-describedby={fe?.slug ? "err-slug" : undefined}
            className={controlClasses(Boolean(fe?.slug))}
          />
          {fe?.slug ? (
            <p id="err-slug">
              <InlineFieldError message={fe.slug} />
            </p>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          First gym branch name
          <input
            name="outlet_name"
            required
            defaultValue={v?.outlet_name}
            aria-invalid={Boolean(fe?.outlet_name)}
            aria-describedby={fe?.outlet_name ? "err-outlet-name" : undefined}
            className={controlClasses(Boolean(fe?.outlet_name))}
          />
          {fe?.outlet_name ? (
            <p id="err-outlet-name">
              <InlineFieldError message={fe.outlet_name} />
            </p>
          ) : null}
        </label>

        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:col-span-2">
          First branch location (required)
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Street address
          <input
            name="street_address"
            required
            autoComplete="street-address"
            placeholder="Building, street"
            defaultValue={v?.street_address}
            aria-invalid={Boolean(fe?.street_address)}
            aria-describedby={fe?.street_address ? "err-street" : undefined}
            className={controlClasses(Boolean(fe?.street_address))}
          />
          {fe?.street_address ? (
            <p id="err-street">
              <InlineFieldError message={fe.street_address} />
            </p>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          City
          <input
            name="city"
            required
            autoComplete="address-level2"
            defaultValue={v?.city}
            aria-invalid={Boolean(fe?.city)}
            aria-describedby={fe?.city ? "err-city" : undefined}
            className={controlClasses(Boolean(fe?.city))}
          />
          {fe?.city ? (
            <p id="err-city">
              <InlineFieldError message={fe.city} />
            </p>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          State / region
          <input
            name="state"
            required
            autoComplete="address-level1"
            defaultValue={v?.state}
            aria-invalid={Boolean(fe?.state)}
            aria-describedby={fe?.state ? "err-region" : undefined}
            className={controlClasses(Boolean(fe?.state))}
          />
          {fe?.state ? (
            <p id="err-region">
              <InlineFieldError message={fe.state} />
            </p>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Postal code
          <input
            name="postal_code"
            required
            autoComplete="postal-code"
            defaultValue={v?.postal_code}
            aria-invalid={Boolean(fe?.postal_code)}
            aria-describedby={fe?.postal_code ? "err-postal" : undefined}
            className={controlClasses(Boolean(fe?.postal_code))}
          />
          {fe?.postal_code ? (
            <p id="err-postal">
              <InlineFieldError message={fe.postal_code} />
            </p>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Country (ISO, 2 letters)
          <input
            name="country"
            placeholder="IN"
            maxLength={2}
            defaultValue={v?.country}
            aria-invalid={Boolean(fe?.country)}
            aria-describedby={fe?.country ? "err-country" : undefined}
            className={`${controlClasses(Boolean(fe?.country))} font-mono`}
          />
          {fe?.country ? (
            <p id="err-country">
              <InlineFieldError message={fe.country} />
            </p>
          ) : (
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">Leave blank for IN.</span>
          )}
        </label>

        {/*
          Optional brand logo — same field name as `formData.get("brand_logo")` in onboardGymAction.
          Stored in Supabase Storage bucket `gym-brand-logos` (see gym-brand-logos-storage.ts + migration 002).
          Do not set encType on this <form>: action is a Server Action; React sets multipart when needed.
          File inputs cannot be repopulated from server state after errors; user may need to re-pick.
        */}
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Brand logo (optional)
          <input
            name="brand_logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className={`${controlClasses(false)} text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orange-800 hover:file:bg-orange-100 dark:file:bg-orange-950/50 dark:file:text-orange-200`}
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            PNG, JPEG, WebP, or GIF — up to 2 MB. Uploaded to the{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.7rem] dark:bg-zinc-800">gym-brand-logos</code>{" "}
            bucket; URL saved to{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.7rem] dark:bg-zinc-800">organizations.logo_url</code>.
          </span>
        </label>
      </div>

      <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Gym owner account</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Creates a <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.65rem] dark:bg-zinc-800">gym_owner</code>{" "}
          staff assignment on the first branch (org-wide access to all locations). For production, prefer passwordless
          invites; this form exists to make local testing fast.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Owner full name
            <input
              name="admin_full_name"
              defaultValue={v?.admin_full_name}
              aria-invalid={Boolean(fe?.admin_full_name)}
              aria-describedby={fe?.admin_full_name ? "err-admin-name" : undefined}
              className={controlClasses(Boolean(fe?.admin_full_name))}
            />
            {fe?.admin_full_name ? (
              <p id="err-admin-name">
                <InlineFieldError message={fe.admin_full_name} />
              </p>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Owner email
            <input
              name="admin_email"
              type="email"
              required
              defaultValue={v?.admin_email}
              autoComplete="email"
              aria-invalid={Boolean(fe?.admin_email)}
              aria-describedby={fe?.admin_email ? "err-admin-email" : undefined}
              className={controlClasses(Boolean(fe?.admin_email))}
            />
            {fe?.admin_email ? (
              <p id="err-admin-email">
                <InlineFieldError message={fe.admin_email} />
              </p>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
            Temporary password (sign-in)
            <input
              name="admin_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={Boolean(fe?.admin_password)}
              aria-describedby={
                fe?.admin_password
                  ? "err-admin-password"
                  : v && !fe?.admin_password
                    ? "hint-admin-password"
                    : undefined
              }
              className={controlClasses(Boolean(fe?.admin_password))}
            />
            {fe?.admin_password ? (
              <p id="err-admin-password">
                <InlineFieldError message={fe.admin_password} />
              </p>
            ) : null}
            {v && !fe?.admin_password ? (
              <span
                id="hint-admin-password"
                className="text-xs font-normal text-zinc-500 dark:text-zinc-400"
              >
                Re-enter your password after fixing the issue above (not stored in the session for security).
              </span>
            ) : null}
          </label>
        </div>
      </div>

      {state.error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-orange-600 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Creating…" : "Create gym + owner"}
      </button>
    </form>
  );
}
