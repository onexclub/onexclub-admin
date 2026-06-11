import Link from "next/link";
import type { AccountHeaderSummary } from "@/lib/account/current-user-profile";
import type { DashboardShellTheme } from "@/components/layout/SidebarNav";
import { StaffAvatar } from "@/components/dashboard/StaffAvatar";

/**
 * Header profile chip (top-right) — links to `/dashboard/profile`. Role is shown on the profile page only.
 */
export function AccountHeaderLink({
  account,
  shellTheme,
}: {
  account: AccountHeaderSummary;
  shellTheme: DashboardShellTheme;
}) {
  const linkClass =
    shellTheme === "superadmin"
      ? "inline-flex max-w-[min(100%,14rem)] items-center gap-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/40 py-1 pl-1 pr-3.5 transition hover:border-orange-500/45 hover:bg-orange-500/10"
      : "inline-flex max-w-[min(100%,14rem)] items-center gap-2.5 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3.5 shadow-sm transition hover:border-orange-300 hover:bg-orange-50";

  const nameClass =
    shellTheme === "superadmin"
      ? "truncate text-sm font-medium leading-tight text-zinc-100"
      : "truncate text-sm font-medium leading-tight text-zinc-900";

  return (
    <Link href={account.href} className={linkClass} title="My profile" aria-label="Open my profile">
      <StaffAvatar
        avatarUrl={account.avatarUrl}
        fullName={account.displayName}
        email={account.email}
        size="sm"
      />
      <span className={`min-w-0 ${nameClass}`}>{account.displayName}</span>
    </Link>
  );
}
