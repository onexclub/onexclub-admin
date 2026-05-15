"use client";

/**
 * Organization (gym brand) editor for platform superadmins — name, slug, optional logo swap/clear.
 * Pairs with `updateOrganizationAction` from `@/app/superadmin/gyms/actions` (same bucket + validation as onboarding).
 */

import { useActionState } from "react";
import type { UpdateOrganizationState } from "@/app/superadmin/gyms/actions";
import { updateOrganizationAction } from "@/app/superadmin/gyms/actions";
import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";

const initial: UpdateOrganizationState = {};

export type EditOrganizationPrefill = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

export function EditOrganizationForm({ org }: { org: EditOrganizationPrefill }) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="organization_id" value={org.id} />

      <div className="flex flex-wrap items-start gap-4">
        <GymLogoThumbnail logoUrl={org.logo_url} name={org.name} size="hero" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Current thumbnail preview. Replace with a file below or check &quot;Remove logo&quot;.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Organization name
          <input
            name="organization_name"
            required
            defaultValue={org.name}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          Slug <span className="font-normal text-zinc-500 dark:text-zinc-400">(URL-safe)</span>
          <input
            name="slug"
            defaultValue={org.slug}
            spellCheck={false}
            autoComplete="off"
            placeholder="derived from organization name when blank after save"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            Leave unchanged if you don’t need a typo fix — must remain unique platform-wide.
          </span>
        </label>

        {/*
          Reuse onboarding field name (`brand_logo`) so the same Storage upload helpers apply —
          see `uploadGymBrandLogoForOrganization` in `@/lib/supabase/gym-brand-logos-storage`.
        */}
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          New brand logo (optional)
          <input
            name="brand_logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orange-800 hover:file:bg-orange-100 dark:file:bg-orange-950/50 dark:file:text-orange-200"
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            PNG, JPEG, WebP, or GIF — up to 2 MB. Uploading clears previous objects in Storage for this org first.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:col-span-2">
          <input type="checkbox" name="clear_logo" className="size-4 rounded border-zinc-400 text-orange-600" />
          Remove logo from this organization (ignored if you also upload a new file)
        </label>
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
        {pending ? "Saving…" : "Save organization"}
      </button>
    </form>
  );
}
