"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeGymBrandLogoUrl } from "@/lib/supabase/gym-brand-logos-storage";

/**
 * Gym brand thumbnails for superadmin listings (organizations.logo_url → Supabase Storage).
 * Shared by `SuperadminGymsPage` and `SuperadminGymOrganizationPage` so logo behavior stays consistent.
 *
 * **Client boundary:** Needed for `<img onError>` fallback when CDN returns 403/404 after URL/env drift,
 * plus `referrerPolicy` for strict edge caches.
 *
 * **Important:** If `onError` sets fallback mode, we must reset when `logoUrl` changes (e.g. user uploads a
 * new logo after a failed or empty URL — otherwise the initials box sticks forever until full page reload).
 */

type GymLogoThumbnailProps = {
  logoUrl: string | null | undefined;
  name: string;
  /** `sm`: table/list rows; `hero`: org detail header. */
  size?: "sm" | "hero";
};

export function GymLogoThumbnail({ logoUrl, name, size = "sm" }: GymLogoThumbnailProps) {
  const [broken, setBroken] = useState(false);

  /** Same origin as SSR/build — public env is mandatory for Supabase-backed pages. */
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  const resolved = useMemo(
    () => normalizeGymBrandLogoUrl(logoUrl, supabaseOrigin),
    [logoUrl, supabaseOrigin],
  );

  useEffect(() => {
    setBroken(false);
  }, [logoUrl]);

  const fallbackBox =
    size === "sm"
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-[0.65rem] font-semibold uppercase text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500"
      : "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs font-semibold uppercase text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500";
  const imgBox =
    size === "sm"
      ? "h-10 w-10 shrink-0 rounded-lg border border-zinc-200 bg-white object-contain dark:border-zinc-700"
      : "h-14 w-14 shrink-0 rounded-xl border border-zinc-200 bg-white object-contain dark:border-zinc-700";

  if (!resolved || broken) {
    return (
      <span className={fallbackBox} title={resolved ? "Logo failed to load" : "No logo"}>
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote Supabase URLs; avoids next/image remotePatterns upkeep.
    <img
      key={resolved}
      src={resolved}
      alt=""
      className={imgBox}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
