import { redirect } from "next/navigation";
import { getAuthDashboardContext } from "@/services/auth.service";
import { homePathForRole, ROUTES } from "@/utils/routes";

/**
 * After email/password login we land here to pick the correct dashboard.
 * Keeps `loginAction` simple and centralizes role → route mapping.
 */
export default async function PostLoginPage() {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }
  redirect(homePathForRole(ctx.appRole));
}
