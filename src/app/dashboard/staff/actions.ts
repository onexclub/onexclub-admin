"use server";

import { revalidatePath } from "next/cache";
import { ASSIGNABLE_ROLES, canManageStaffAssignments, ROLES, type AssignableStaffRole } from "@/lib/auth/roles";
import { uploadProfileAvatar } from "@/lib/supabase/profile-avatars-storage";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES, dashboardStaffAssignmentPath } from "@/utils/routes";

export type StaffActionState = { error?: string; success?: string; assignmentId?: string };

const ASSIGNABLE_STRINGS = ASSIGNABLE_ROLES as readonly AssignableStaffRole[];

/** Waits for `handle_new_user` trigger row, then persists `profiles.full_name` (service role). */
async function persistStaffProfileDisplay(
  service: ReturnType<typeof createServiceRoleSupabaseClient>,
  profileId: string,
  email: string,
  fullName: string,
  phone: string,
  avatarUrl?: string,
): Promise<void> {
  const displayName = fullName.trim() || email;
  const patch: Record<string, string> = {
    full_name: displayName,
    email,
  };
  if (phone.trim()) patch.phone = phone.trim();
  if (avatarUrl) patch.avatar_url = avatarUrl;

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data } = await service.from("profiles").update(patch).eq("id", profileId).select("id").maybeSingle();
    if (data?.id) return;
    await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
  }

  await service.from("profiles").upsert(
    { id: profileId, ...patch },
    { onConflict: "id" },
  );
}

function outletAllowedForInvite(ctx: Awaited<ReturnType<typeof getAuthDashboardContext>>, outletId: string) {
  if (ctx.appRole === ROLES.SUPERADMIN) return true;
  return canManageOutletForBranchAdmin(ctx, outletId);
}

async function applyAvatarFromForm(
  service: ReturnType<typeof createServiceRoleSupabaseClient>,
  profileId: string,
  formData: FormData,
): Promise<string | undefined> {
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || avatar.size === 0) return undefined;

  const uploaded = await uploadProfileAvatar(service, profileId, avatar);
  if (!uploaded.ok) {
    throw new Error(uploaded.message);
  }
  return uploaded.publicUrl;
}

/**
 * Creates Auth user with email + temporary password, then inserts `staff_assignments`.
 *
 * **Reuse:** Same service-role `createUser` pattern as `admin/members/onboard/actions.ts`, but targets roster rows.
 * No invite / magic-link flow — staff change password later from their account settings.
 */
export async function createStaffMemberAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canManageStaffAssignments(ctx.appRole)) {
    return { error: "Only gym owners (or platform superadmins) can add teammates." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as AssignableStaffRole;
  const isPrimary = formData.get("is_primary") === "on";

  if (!email || !outletId) {
    return { error: "Email and branch are required." };
  }
  if (!ASSIGNABLE_STRINGS.includes(role)) {
    return { error: "Unsupported role selection." };
  }
  if (!outletAllowedForInvite(ctx, outletId)) {
    return { error: "You cannot manage that branch." };
  }

  const supabase = await createServerSupabaseClient();
  const service = createServiceRoleSupabaseClient();

  const { data: existingProfile } = await service.from("profiles").select("id").eq("email", email).maybeSingle();

  let profileId = existingProfile?.id;

  if (!profileId) {
    if (!password) {
      return { error: "Temporary password is required for new accounts." };
    }
    if (password.length < 8) {
      return { error: "Temporary password must be at least 8 characters." };
    }

    const { data: created, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.length ? fullName : email },
    });

    if (authError || !created.user) {
      const msg = authError?.message ?? "Failed to create account.";
      if (msg.toLowerCase().includes("already been registered")) {
        const { data: fallback } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
        profileId = fallback?.id;
      }
      if (!profileId) {
        return { error: msg };
      }
    } else {
      profileId = created.user.id;
    }
  }

  if (!profileId) {
    return { error: "Unable to resolve profile for this email." };
  }

  if (profileId === ctx.user.id) {
    return { error: "You cannot roster yourself from this form." };
  }

  let avatarUrl: string | undefined;
  try {
    avatarUrl = await applyAvatarFromForm(service, profileId, formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Photo upload failed." };
  }

  await persistStaffProfileDisplay(service, profileId, email, fullName, phone, avatarUrl);

  const { data: collide } = await supabase
    .from("staff_assignments")
    .select("id")
    .eq("profile_id", profileId)
    .eq("outlet_id", outletId)
    .is("revoked_at", null)
    .maybeSingle();

  if (collide?.id) {
    return { error: "This person already has an active assignment at that branch." };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("staff_assignments")
    .insert({
      profile_id: profileId,
      outlet_id: outletId,
      role,
      is_primary: isPrimary,
      assigned_by: ctx.user.id,
      invite_pending: false,
      notes: "created_via_dashboard",
    })
    .select("id")
    .maybeSingle();

  if (insertErr || !inserted?.id) {
    return { error: insertErr?.message ?? "Could not save roster row." };
  }

  revalidatePath(ROUTES.dashboardStaff);
  revalidatePath(dashboardStaffAssignmentPath(inserted.id));
  revalidatePath(ROUTES.dashboard);

  return {
    success: `${fullName || email} is on the roster. Share the temporary password securely — they can change it after signing in.`,
    assignmentId: inserted.id,
  };
}

/** Updates display fields on a teammate profile (service role after authz). */
export async function updateStaffProfileAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canManageStaffAssignments(ctx.appRole)) {
    return { error: "Only gym owners can edit teammate profiles." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!assignmentId) return { error: "Missing assignment." };

  const supabase = await createServerSupabaseClient();
  const { data: row, error: loadErr } = await supabase
    .from("staff_assignments")
    .select("id,outlet_id,profile_id")
    .eq("id", assignmentId)
    .is("revoked_at", null)
    .maybeSingle();

  if (loadErr || !row?.profile_id || !row.outlet_id) {
    return { error: "Assignment not found." };
  }
  if (!outletAllowedForInvite(ctx, row.outlet_id)) {
    return { error: "You cannot edit teammates at that branch." };
  }

  const service = createServiceRoleSupabaseClient();

  let avatarUrl: string | undefined;
  try {
    avatarUrl = await applyAvatarFromForm(service, row.profile_id, formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Photo upload failed." };
  }

  const { data: existing } = await service.from("profiles").select("email").eq("id", row.profile_id).maybeSingle();
  const email = (existing?.email as string | undefined) ?? "";
  await persistStaffProfileDisplay(service, row.profile_id, email, fullName, phone, avatarUrl);

  revalidatePath(ROUTES.dashboardStaff);
  revalidatePath(dashboardStaffAssignmentPath(assignmentId));
  return { success: "Profile updated." };
}

/** Updates role / branch / primary flag for one assignment row. */
export async function updateStaffAssignmentAction(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canManageStaffAssignments(ctx.appRole)) {
    return { error: "Only gym owners can change assignments." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as AssignableStaffRole;
  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const isPrimary = formData.get("is_primary") === "on";

  if (!assignmentId || !outletId || !ASSIGNABLE_STRINGS.includes(role)) {
    return { error: "Role and branch are required." };
  }
  if (!outletAllowedForInvite(ctx, outletId)) {
    return { error: "You cannot assign that branch." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: row, error: loadErr } = await supabase
    .from("staff_assignments")
    .select("id,outlet_id,profile_id")
    .eq("id", assignmentId)
    .is("revoked_at", null)
    .maybeSingle();

  if (loadErr || !row?.profile_id) {
    return { error: "Assignment not found." };
  }
  if (!outletAllowedForInvite(ctx, row.outlet_id)) {
    return { error: "You cannot edit this assignment." };
  }

  if (outletId !== row.outlet_id) {
    const { data: collide } = await supabase
      .from("staff_assignments")
      .select("id")
      .eq("profile_id", row.profile_id)
      .eq("outlet_id", outletId)
      .is("revoked_at", null)
      .maybeSingle();

    if (collide?.id && collide.id !== assignmentId) {
      return { error: "They already have an active row at that branch." };
    }
  }

  const { error } = await supabase
    .from("staff_assignments")
    .update({ role, outlet_id: outletId, is_primary: isPrimary })
    .eq("id", assignmentId);

  if (error) return { error: error.message };

  revalidatePath(ROUTES.dashboardStaff);
  revalidatePath(dashboardStaffAssignmentPath(assignmentId));
  return { success: "Assignment updated." };
}

/** Soft revoke roster access while retaining history for auditors. */
export async function revokeStaffAssignmentAction(formData: FormData): Promise<void> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canManageStaffAssignments(ctx.appRole)) return;

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  if (!assignmentId) return;

  const supabase = await createServerSupabaseClient();

  const { data: row, error: loadErr } = await supabase
    .from("staff_assignments")
    .select("id,outlet_id")
    .eq("id", assignmentId)
    .is("revoked_at", null)
    .maybeSingle();

  if (loadErr || !row?.outlet_id) return;
  if (!outletAllowedForInvite(ctx, row.outlet_id)) return;

  await supabase.from("staff_assignments").update({ revoked_at: new Date().toISOString() }).eq("id", assignmentId);

  revalidatePath(ROUTES.dashboardStaff);
  revalidatePath(dashboardStaffAssignmentPath(assignmentId));
  revalidatePath(ROUTES.dashboard);
}
