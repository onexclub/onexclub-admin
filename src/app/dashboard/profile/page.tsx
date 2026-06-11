import { redirect } from "next/navigation";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { MyProfilePanel } from "@/components/account/MyProfilePanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadCurrentUserProfilePageData } from "@/lib/account/current-user-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

/** Signed-in account — role, branch access, and editable contact details. */

export default async function DashboardProfilePage() {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) redirect(ROUTES.login);

  const supabase = await createServerSupabaseClient();
  const profile = await loadCurrentUserProfilePageData(supabase, ctx);

  return (
    <RoleGuard role={ctx.appRole} feature="dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">My profile</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your account details, role, and branch access.
          </p>
        </div>

        {!profile ? (
          <EmptyState
            title="Profile not found"
            description="We could not load your account. Try signing out and back in."
          />
        ) : (
          <MyProfilePanel profile={profile} />
        )}
      </div>
    </RoleGuard>
  );
}
