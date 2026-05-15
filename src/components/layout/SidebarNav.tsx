import Image from "next/image";
import Link from "next/link";
import { SidebarGymRail } from "@/components/admin/SidebarGymRail";

export type NavItem = { href: string; label: string; badge?: string };

/** Passed from `DashboardShell` — dark (`superadmin`) is shared by platform + gym admin; light (`admin`) is staff. */
export type DashboardShellTheme = "superadmin" | "admin";

/** Left-rail masthead: platform mark vs gym-logo-only rail for `/admin`. */
export type DashboardSidebarRailBrand =
  | { kind: "platform" }
  | { kind: "gym"; name: string; logoUrl: string | null; profileHref: string };

type SidebarNavProps = {
  items: NavItem[];
  shellTheme: DashboardShellTheme;
  railBrand?: DashboardSidebarRailBrand;
};

/**
 * Responsive navigation: horizontal strip on small screens, column on `lg+`.
 * Wrapped in a single flex child so `DashboardShell` row layout stays predictable.
 */
export function SidebarNav({ items, shellTheme, railBrand = { kind: "platform" } }: SidebarNavProps) {
  const wrap =
    shellTheme === "superadmin"
      ? "border-b border-orange-500/20 bg-[#161616] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:border-orange-500/15"
      : "border-b border-zinc-200 bg-white lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:border-zinc-200";

  const mobileLink =
    shellTheme === "superadmin"
      ? "whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 hover:border-orange-400 hover:text-orange-100"
      : "whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-orange-500 hover:text-orange-800";

  const desktopLink =
    shellTheme === "superadmin"
      ? "block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-orange-500/10 hover:text-orange-50"
      : "block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-orange-50 hover:text-orange-900";

  return (
    <div className={wrap}>
      <div className={`px-4 py-3 lg:px-6 lg:pt-6 ${shellTheme === "superadmin" ? "border-b border-orange-500/10 lg:border-b-0" : "border-b border-zinc-100 lg:border-b-0"}`}>
        {railBrand.kind === "gym" ? (
          <SidebarGymRail name={railBrand.name} logoUrl={railBrand.logoUrl} profileHref={railBrand.profileHref} />
        ) : (
          <div className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:pt-0">
            <div className="relative hidden size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-orange-500/40 lg:block lg:size-12">
              <Image src="/brand/logo-emblem.png" alt="ONE X CLUB" fill className="object-cover" sizes="48px" />
            </div>
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-orange-500/35 lg:hidden">
              <Image src="/brand/logo-emblem.png" alt="ONE X CLUB" fill className="object-cover" sizes="36px" />
            </div>
            <p
              className={`min-w-0 text-xs font-semibold uppercase tracking-wider lg:text-[11px] ${shellTheme === "superadmin" ? "text-gradient-brand" : "text-orange-600"}`}
            >
              One X Club
            </p>
          </div>
        )}
      </div>
      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto px-4 py-2 lg:hidden">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={mobileLink}>
            <span className="flex items-center gap-2">
              {item.label}
              {item.badge ? (
                <span className="rounded-full border border-zinc-500/40 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {item.badge}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>
      <aside className="hidden lg:block">
        {/* No "Navigation" label — links are self-explanatory; keeps the rail compact. */}
        <nav className="space-y-1 px-4 pb-8 pt-5">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={desktopLink}>
              <span className="flex flex-wrap items-center gap-2">
                {item.label}
                {item.badge ? (
                  <span className="rounded-full border border-zinc-500/40 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
