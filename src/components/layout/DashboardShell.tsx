import type { ReactNode } from "react";
import { SidebarNav, type DashboardShellTheme, type DashboardSidebarRailBrand, type NavItem } from "@/components/layout/SidebarNav";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { AccountHeaderLink } from "@/components/account/AccountHeaderLink";
import { ActiveBranchSwitcher, type ActiveBranchSwitcherOption } from "@/components/layout/ActiveBranchSwitcher";
import type { AccountHeaderSummary } from "@/lib/account/current-user-profile";
import type { ActiveBranchScope } from "@/lib/auth/active-branch-session";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  children: ReactNode;
  /**
   * `superadmin`: dark chrome + orange accents (platform + gym-admin consoles share this shell).
   * `admin`: light chrome — kept for staff-only flows that should stay subdued.
   */
  shellTheme: DashboardShellTheme;
  /**
   * Sidebar masthead only. `{ kind: "gym" }` swaps the ONE X CLUB emblem for a gym-logo-only rail (see `/admin`).
   */
  railBrand?: DashboardSidebarRailBrand;
  /** Signed-in user chip — links to `/dashboard/profile`. */
  account?: AccountHeaderSummary | null;
  /** Multi-branch gym admins — same cookie as `/auth/choose-branch`. */
  branchSwitcher?: {
    branches: ActiveBranchSwitcherOption[];
    activeOutletId: string | null;
    scope: ActiveBranchScope;
  } | null;
};

/**
 * Shared responsive shell for `/superadmin`, `/admin`, and `/staff`.
 * Reuse this component when adding new dashboard sections so navigation stays consistent.
 */
export function DashboardShell({
  title,
  subtitle,
  navItems,
  children,
  shellTheme,
  railBrand = { kind: "platform" },
  account = null,
  branchSwitcher = null,
}: DashboardShellProps) {
  const shell =
    shellTheme === "superadmin"
      ? "dark dashboard-shell dashboard-shell--superadmin flex min-h-screen flex-col bg-[#121212] text-zinc-100 lg:flex-row"
      : "dashboard-shell dashboard-shell--admin flex min-h-screen flex-col bg-[#f5f5f5] text-zinc-900 lg:flex-row";

  const header =
    shellTheme === "superadmin"
      ? "sticky top-0 z-10 flex items-center justify-between border-b border-orange-500/25 bg-[#141414]/95 px-4 py-3 backdrop-blur lg:px-8"
      : "sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8";

  const subtitleClass =
    shellTheme === "superadmin" ? "text-sm text-zinc-400" : "text-sm text-zinc-500";

  return (
    <div className={shell}>
      <SidebarNav items={navItems} shellTheme={shellTheme} railBrand={railBrand} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className={header}>
          <div className="min-w-0 flex-1 pr-4">
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 self-center">
            {branchSwitcher ? (
              <ActiveBranchSwitcher
                branches={branchSwitcher.branches}
                activeOutletId={branchSwitcher.activeOutletId}
                scope={branchSwitcher.scope}
                shellTheme={shellTheme}
              />
            ) : null}
            {account ? <AccountHeaderLink account={account} shellTheme={shellTheme} /> : null}
            <SignOutButton shellTheme={shellTheme} />
          </div>
        </header>
        <main className="flex-1 space-y-6 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
