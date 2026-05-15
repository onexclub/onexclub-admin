"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { isStaffConsoleRole } from "@/types/roles";
import { ROUTES } from "@/utils/routes";

export type StaffCheckInState = { error?: string; success?: string };

export async function staffCheckInAction(
  _prev: StaffCheckInState,
  formData: FormData,
): Promise<StaffCheckInState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !isStaffConsoleRole(ctx.appRole)) {
    return { error: "Forbidden: receptionist or trainer only." };
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();

  if (!outletId || !profileId) {
    return { error: "Pick a member to check in." };
  }

  const allowed = ctx.staffAssignments.some((s) => s.outlet_id === outletId);
  if (!allowed) {
    return { error: "You are not assigned to that outlet." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("check_ins").insert({
    profile_id: profileId,
    outlet_id: outletId,
    method: "manual",
    recorded_by: ctx.user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${ROUTES.staff}/members`);
  return { success: "Check-in recorded." };
}
