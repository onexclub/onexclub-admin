import Link from "next/link";
import { redirect } from "next/navigation";
import { ChooseBranchPanel } from "@/components/auth/ChooseBranchPanel";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { loadManagedOutletsForAdmin } from "@/lib/admin/gym-organization-dashboard";
import { resolveActiveBranchSession, safeDashboardNextPath } from "@/lib/auth/active-branch-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { isGymAdminShellRole } from "@/types/roles";
import { homePathForRole, ROUTES } from "@/utils/routes";

/**
 * Shown after login when a gym admin manages multiple branches and has no working branch cookie yet.
 * **Reuse:** same cookie + actions as header {@link ActiveBranchSwitcher}.
 */
export default async function ChooseBranchPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await getAuthDashboardContext();

  if (!ctx.user) {
    redirect(ROUTES.login);
  }

  if (!isGymAdminShellRole(ctx.appRole)) {
    redirect(homePathForRole(ctx.appRole));
  }

  const session = await resolveActiveBranchSession(ctx);
  const nextPath = safeDashboardNextPath(sp.next);

  if (!session.requiresSelection) {
    redirect(nextPath);
  }

  const supabase = await createServerSupabaseClient();
  const outlets = await loadManagedOutletsForAdmin(supabase, ctx);

  if (outlets.length <= 1) {
    redirect(nextPath);
  }

  const userName =
    ctx.profile?.full_name?.trim() ||
    ctx.user.email?.split("@")[0] ||
    "there";

  const branches = outlets.map((o) => ({
    id: o.id,
    name: o.name,
    city: o.city,
  }));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="mb-8 flex flex-col items-center gap-3">
        <BrandLogo variant="emblem" priority />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">One X Club · Admin</p>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <ChooseBranchPanel branches={branches} nextPath={nextPath} userName={userName} />
        <p className="mt-6 text-center text-sm">
          <Link href={ROUTES.dashboardProfile} className="font-medium text-orange-700 hover:underline">
            View my profile
          </Link>
        </p>
      </div>
    </div>
  );
}
