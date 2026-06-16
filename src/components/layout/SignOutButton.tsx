import { signOutAction } from "@/app/auth/signout/actions";
import type { DashboardShellTheme } from "@/components/layout/SidebarNav";

type SignOutButtonProps = {
  shellTheme: DashboardShellTheme;
};

export function SignOutButton({ shellTheme }: SignOutButtonProps) {
  const btn =
    shellTheme === "superadmin"
      ? "rounded-lg border border-orange-500/35 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-orange-500/15 hover:border-orange-400/60"
      : "rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-orange-50 hover:border-orange-200 hover:text-orange-900";

  return (
    <form action={signOutAction}>
      <button type="submit" className={btn}>
        Log out
      </button>
    </form>
  );
}
