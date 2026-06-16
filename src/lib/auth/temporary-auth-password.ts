import type { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";

type ServiceAdmin = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Sets a temporary sign-in password via Supabase Auth Admin API (service role).
 *
 * **Reuse:** superadmin gym owner reassignment (`reassignGymOwnerAction`); member onboard
 * uses the same Admin API inline in `admin/members/onboard/actions.ts`.
 */
export async function applyTemporaryAuthPassword(
  admin: ServiceAdmin,
  profileId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { ok: false, message: "Temporary password must be at least 8 characters." };
  }

  const { error } = await admin.auth.admin.updateUserById(profileId, { password: trimmed });
  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
