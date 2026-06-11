"use server";

import { revalidatePath } from "next/cache";
import { normalizeToE164 } from "@/lib/auth/phone-e164";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { uploadProfileAvatar } from "@/lib/supabase/profile-avatars-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

export type MyProfileActionState = { error?: string; success?: string };

/**
 * Signed-in user updates their own profile (`profiles` RLS: `own_profile_update`).
 * Avatar upload uses service role after verifying `profileId === auth.uid()`.
 */
export async function updateMyProfileAction(
  _prev: MyProfileActionState,
  formData: FormData,
): Promise<MyProfileActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) return { error: "You need to sign in again." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  let phoneE164: string | null = null;
  if (phoneRaw.length > 0) {
    const normalized = normalizeToE164(phoneRaw);
    if (!normalized.ok) return { error: normalized.message };
    phoneE164 = normalized.e164;
  }

  let avatarUrl: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const service = createServiceRoleSupabaseClient();
    const uploaded = await uploadProfileAvatar(service, ctx.user.id, avatar);
    if (!uploaded.ok) return { error: uploaded.message };
    avatarUrl = uploaded.publicUrl;
  }

  const patch: Record<string, string | null> = {
    full_name: fullName || null,
    phone: phoneE164,
  };
  if (avatarUrl) patch.avatar_url = avatarUrl;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").update(patch).eq("id", ctx.user.id);
  if (error) return { error: error.message };

  if (phoneE164) {
    const service = createServiceRoleSupabaseClient();
    await service.auth.admin.updateUserById(ctx.user.id, { phone: phoneE164, phone_confirm: true });
  }

  revalidatePath(ROUTES.dashboardProfile);
  revalidatePath(ROUTES.dashboard);
  return { success: "Your profile has been updated." };
}
