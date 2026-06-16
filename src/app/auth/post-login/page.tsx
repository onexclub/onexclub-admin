import { redirect } from "next/navigation";
import { resolvePostLoginRedirect } from "@/lib/auth/active-branch-session";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

/**
 * After email/password login we land here to pick the correct dashboard.
 * Gym admins with multiple branches are sent to `/auth/choose-branch` first.
 */
export default async function PostLoginPage() {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  redirect(await resolvePostLoginRedirect(ctx));
}
