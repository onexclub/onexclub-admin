"use client";

/**
 * Gym admin settings: HQ profile (owners), branch address, weekly hours, holiday closures.
 *
 * **Reuse:** Render from `/admin/organization` and `/dashboard/branches` with the same props.
 * Server actions live in `@/app/admin/organization/actions`.
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GymSettingsActionState } from "@/app/admin/organization/actions";
import {
  updateGymOrganizationProfileAction,
  uploadGymOrganizationBrandLogoAction,
  updateOutletBranchProfileAction,
  updateOutletScheduleAction,
} from "@/app/admin/organization/actions";
import type { GymDashboardOrganization, ManagedOutletDetail } from "@/lib/admin/gym-organization-shared";
import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";
import {
  formatClosurePreview,
  formatHolidayLinesForTextarea,
  formatWeeklyHoursSummary,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
} from "@/lib/outlets/schedule";

/** Inputs align with `updateOutletScheduleAction`: `${day}_closed`, `${day}_24h`, `${day}_open(2)`, `${day}_close(2)`. */

const initial: GymSettingsActionState = {};

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

function Flash({ state }: { state: GymSettingsActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
        {state.success}
      </p>
    );
  }
  return null;
}

export function GymOrganizationBrandLogoForm({
  org,
  canEdit,
}: {
  org: GymDashboardOrganization;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(uploadGymOrganizationBrandLogoAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (!canEdit) return null;

  return (
    <form action={action} className="space-y-4 rounded-xl border border-orange-500/25 bg-[#151515] p-6 text-zinc-100">
      {/*
        With action={serverAction}, React/Next sets method=POST and multipart encoding when file inputs are present.
        Do not set encType or method on <form> — React warns they will be overridden.
      */}
      <div>
        <h3 className="text-base font-semibold text-zinc-50">Brand logo</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Uploaded to Storage (<span className="font-mono text-zinc-500">gym-brand-logos</span>) via a{" "}
          <span className="font-medium text-zinc-300">separate</span> form from HQ text — smaller multipart requests are
          more reliable (see <span className="font-mono text-zinc-500">uploadGymOrganizationBrandLogoAction</span>).
        </p>
      </div>
      <input type="hidden" name="organization_id" value={org.id} />

      <div className="flex flex-wrap items-start gap-4 rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-4">
        <GymLogoThumbnail logoUrl={org.logo_url} name={org.name} size="hero" />
        <div className="min-w-0 flex-1 space-y-3">
          {/*
            Field name `brand_logo` matches superadmin `EditOrganizationForm` / onboarding so the same Storage helpers apply.
          */}
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-200">
            New brand logo
            <input
              name="brand_logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className={`${inputClass} text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-950/80 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orange-200 hover:file:bg-orange-900/80`}
            />
            <span className="text-xs font-normal text-zinc-500">
              PNG, JPEG, WebP, or GIF — up to 2 MB. Replaces previous files for this organisation.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <input type="checkbox" name="clear_logo" className="size-4 rounded border-zinc-500 text-orange-600" />
            Remove logo (ignored if you upload a new file)
          </label>
        </div>
      </div>
      <Flash state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {pending ? "Saving logo…" : "Save logo"}
      </button>
    </form>
  );
}

export function GymOrganizationProfileForm({
  org,
  canEdit,
}: {
  org: GymDashboardOrganization;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateGymOrganizationProfileAction, initial);
  const router = useRouter();
  const addr = org.address_json ?? {};

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (!canEdit) return null;

  return (
    <form action={action} className="space-y-4 rounded-xl border border-orange-500/25 bg-[#151515] p-6 text-zinc-100">
      <div>
        <h3 className="text-base font-semibold text-zinc-50">Organisation details (HQ)</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Brand name, legal address, and contact. Logo uploads use the separate &quot;Brand logo&quot; form on this page.
        </p>
      </div>
      <input type="hidden" name="organization_id" value={org.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Gym / brand name
          <input name="organization_name" required defaultValue={org.name} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          Street (HQ)
          <input name="street" defaultValue={addr.street ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          City
          <input name="city" defaultValue={addr.city ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          State
          <input name="state" defaultValue={addr.state ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Postal code
          <input name="postal_code" defaultValue={addr.zip ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Country (ISO)
          <input name="country" maxLength={2} defaultValue={addr.country ?? "IN"} className={`${inputClass} font-mono`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contact email
          <input name="contact_email" type="email" defaultValue={org.contact_email ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contact phone
          <input name="contact_phone" type="tel" defaultValue={org.contact_phone ?? ""} className={inputClass} />
        </label>
      </div>
      <Flash state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save organisation"}
      </button>
    </form>
  );
}

export function OutletBranchSettingsForm({
  outlet,
  canEdit,
}: {
  outlet: ManagedOutletDetail;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateOutletBranchProfileAction, initial);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">{outlet.name}</h4>
      <p className="mt-1 font-mono text-xs text-zinc-500">{outlet.id}</p>
      {!canEdit ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          View only — branch edits require gym owner or branch admin access.
        </p>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="outlet_id" value={outlet.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Branch name
              <input name="branch_name" required defaultValue={outlet.name} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Street address
              <input name="address" defaultValue={outlet.address ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              City
              <input name="city" defaultValue={outlet.city ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              State
              <input name="state" defaultValue={outlet.state ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Country
              <input name="country" maxLength={2} defaultValue={outlet.country ?? "IN"} className={`${inputClass} font-mono`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Phone
              <input name="phone" type="tel" defaultValue={outlet.phone ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Email
              <input name="email" type="email" defaultValue={outlet.email ?? ""} className={inputClass} />
            </label>
          </div>
          <Flash state={state} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg border border-orange-500/40 px-4 text-sm font-semibold text-orange-700 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-orange-950/30"
          >
            {pending ? "Saving…" : "Save branch"}
          </button>
        </form>
      )}
      <OutletScheduleForm outlet={outlet} canEdit={canEdit} />
    </div>
  );
}

export function OutletScheduleForm({
  outlet,
  canEdit,
}: {
  outlet: ManagedOutletDetail;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateOutletScheduleAction, initial);
  const schedule = outlet.opening_hours;
  const closures = schedule.closures ?? [];
  const summary = formatWeeklyHoursSummary(schedule);
  const holidaysTextDefault = formatHolidayLinesForTextarea(closures);
  const weekdayOnlyLegacy = closures.filter((c) => c.weekday && !c.date);

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-950/40">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Operating hours</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Branch timing is stored in <span className="font-mono">outlet_hours</span> (weekly, incl. split shifts &amp; 24h) and{" "}
          <span className="font-mono">outlet_hour_exceptions</span> (holidays / short hours). Roles with branch write access:
          superadmin, gym owner, branch admin (see <span className="font-mono">canWrite(..., &quot;branches&quot;)</span>).
        </p>
        <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">{summary || "No schedule configured"}</p>
      </div>

      {closures.some((c) => c.date) ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Saved holidays</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
            {closures
              .filter((c) => c.date)
              .map((c, i) => (
                <li key={`${c.date}-${i}`} className="text-sm text-zinc-700 dark:text-zinc-200">
                  {formatClosurePreview(c)}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {!canEdit ? null : (
        <form action={action} className="space-y-6">
          <input type="hidden" name="outlet_id" value={outlet.id} />
          <input type="hidden" name="preserved_weekday_closures" value={JSON.stringify(weekdayOnlyLegacy)} />

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/80">
            <table className="min-w-[880px] w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Day</th>
                  <th className="px-3 py-2 font-semibold">Closed</th>
                  <th className="px-3 py-2 font-semibold" title="Open 24 hours (no timed blocks)">
                    24h
                  </th>
                  <th className="px-3 py-2 font-semibold">Morning opens</th>
                  <th className="px-3 py-2 font-semibold">Morning closes</th>
                  <th className="px-3 py-2 font-semibold">Evening opens</th>
                  <th className="px-3 py-2 font-semibold">Evening closes</th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAY_KEYS.map((day) => {
                  const d = schedule.weekly?.[day];
                  return (
                    <tr key={day} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">{WEEKDAY_LABELS[day]}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          name={`${day}_closed`}
                          defaultChecked={Boolean(d?.closed)}
                          className="size-4 rounded border-zinc-400 text-orange-600"
                          title="Closed all day"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          name={`${day}_24h`}
                          defaultChecked={Boolean(d?.is_24_hours)}
                          className="size-4 rounded border-zinc-400 text-orange-600"
                          title="Open 24 hours"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`${day}_open`}
                          type="time"
                          step={60}
                          defaultValue={d?.open ?? ""}
                          className="w-full min-w-[7rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`${day}_close`}
                          type="time"
                          step={60}
                          defaultValue={d?.close ?? ""}
                          className="w-full min-w-[7rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`${day}_open2`}
                          type="time"
                          step={60}
                          defaultValue={d?.shift2_open ?? ""}
                          className="w-full min-w-[7rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          name={`${day}_close2`}
                          type="time"
                          step={60}
                          defaultValue={d?.shift2_close ?? ""}
                          className="w-full min-w-[7rem] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Holidays &amp; one-off closures</span>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Full-day closed: <span className="font-mono">YYYY-MM-DD</span> optional name. Short hours same line:{" "}
                <span className="font-mono">YYYY-MM-DD HH:MM–HH:MM</span> optional name (e.g.{" "}
                <span className="font-mono">2026-04-14 07:00-12:00 Baisakhi</span>). Lines starting with{" "}
                <span className="font-mono">#</span> are comments.
              </span>
              <textarea
                name="holidays_lines"
                rows={5}
                defaultValue={holidaysTextDefault}
                placeholder={"2026-01-26 Republic Day\n2026-03-14 Holi"}
                className={`${inputClass} mt-2 min-h-[120px] resize-y font-mono text-xs`}
                spellCheck={false}
              />
            </label>
            {weekdayOnlyLegacy.length > 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Still stored from an older form:{" "}
                {weekdayOnlyLegacy.map((c) => formatClosurePreview(c)).join(" · ")}. Prefer using &quot;Closed&quot; in the
                weekly table for repeating weekly offs.
              </p>
            ) : null}
          </div>

          <Flash state={state} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save hours & holidays"}
          </button>
        </form>
      )}
    </div>
  );
}
