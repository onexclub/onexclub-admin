"use client";

import Link from "next/link";
import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";

/**
 * Gym-console left rail: clickable gym logo only (no platform emblem).
 * Reuses {@link GymLogoThumbnail} so Supabase URLs and fallbacks match superadmin tooling.
 */

type SidebarGymRailProps = {
  name: string;
  logoUrl: string | null | undefined;
  profileHref: string;
};

export function SidebarGymRail({ name, logoUrl, profileHref }: SidebarGymRailProps) {
  return (
    <div className="flex w-full items-center justify-start py-1 pl-1 pr-2 lg:flex-col lg:items-center lg:justify-center lg:px-4 lg:py-8">
      <Link
        href={profileHref}
        className="group inline-flex shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 lg:rounded-2xl"
        aria-label={`${name} — gym profile`}
        title="Gym profile"
      >
        <span className="inline-flex origin-center scale-[0.95] rounded-xl ring-1 ring-transparent transition group-hover:ring-orange-400/35 lg:scale-[1.18] lg:rounded-2xl lg:p-0.5">
          <GymLogoThumbnail logoUrl={logoUrl} name={name} size="hero" />
        </span>
      </Link>
    </div>
  );
}
