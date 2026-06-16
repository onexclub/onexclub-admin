"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  safeDashboardNextPath,
  setActiveOutletIdCookie,
  validateBranchSelection,
} from "@/lib/auth/active-branch-session";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

export type ChooseBranchState = {
  error?: string;
};

/**
 * Saves the working branch cookie and returns to the dashboard (or `next` path).
 * **Reuse:** choose-branch page cards + header `ActiveBranchSwitcher`.
 */
export async function setActiveBranchAction(
  _prev: ChooseBranchState,
  formData: FormData,
): Promise<ChooseBranchState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) {
    redirect(ROUTES.login);
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const next = safeDashboardNextPath(String(formData.get("next") ?? ""));

  const valid = validateBranchSelection(ctx, outletId);
  if (!valid.ok) {
    return { error: valid.message };
  }

  await setActiveOutletIdCookie(outletId);

  revalidatePath(ROUTES.dashboard);
  redirect(next);
}

/** Convenience for switcher forms that only pass `outlet_id` + optional `next`. */
export async function setActiveBranchFormAction(formData: FormData): Promise<void> {
  await setActiveBranchAction({}, formData);
}
