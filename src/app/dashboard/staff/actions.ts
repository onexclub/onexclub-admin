"use server";

import { revalidatePath } from "next/cache";
import { ASSIGNABLE_ROLES, canManageStaffAssignments, ROLES, type AssignableStaffRole } from "@/lib/auth/roles";
import { normalizeToE164 } from "@/lib/auth/phone-e164";
import { isStaffPhoneRequiredForProvisioning } from "@/lib/auth/role-sign-in-policy";
import { uploadProfileAvatar } from "@/lib/supabase/profile-avatars-storage";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { auditActorOnInsert, auditActorOnUpdate } from "@/lib/supabase/audit-columns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseStaffBranchFormSelection, syncStaffProfileBranchAccess } from "@/lib/admin/staff-branch-assignments";
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
  phoneE164: string | undefined,
  avatarUrl: string | undefined,
  actorProfileId: string,
): Promise<void> {
  const displayName = fullName.trim() || email;
  const patch: Record<string, string> = {
    full_name: displayName,
    email,
    ...auditActorOnUpdate(actorProfileId),
  };
  if (phoneE164) patch.phone = phoneE164;
  if (avatarUrl) patch.avatar_url = avatarUrl;

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data } = await service.from("profiles").update(patch).eq("id", profileId).select("id").maybeSingle();
    if (data?.id) return;
    await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
  }

  await service.from("profiles").upsert(
    { id: profileId, ...patch, ...auditActorOnInsert(actorProfileId) },
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
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as AssignableStaffRole;
  const branchSelection = parseStaffBranchFormSelection(formData);

  let phoneE164: string | undefined;
  if (phoneRaw.length > 0) {
    const normalized = normalizeToE164(phoneRaw);
    if (!normalized.ok) {
      return { error: normalized.message };
    }
    phoneE164 = normalized.e164;
  }
  if (isStaffPhoneRequiredForProvisioning(role) && !phoneE164) {
    return { error: "Phone is required for reception and trainer roles (Phone OTP)." };
  }

  if (!email) {
    return { error: "Email is required." };
  }
  if (!branchSelection.ok) {
    return { error: branchSelection.message };
  }
  if (!ASSIGNABLE_STRINGS.includes(role)) {
    return { error: "Unsupported role selection." };
  }
  for (const outletId of branchSelection.activeOutletIds) {
    if (!outletAllowedForInvite(ctx, outletId)) {
      return { error: "You cannot manage one or more of those branches." };
    }
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
      ...(isStaffPhoneRequiredForProvisioning(role) && phoneE164
        ? { phone: phoneE164, phone_confirm: true }
        : {}),
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

  await persistStaffProfileDisplay(service, profileId, email, fullName, phoneE164, avatarUrl, ctx.user.id);

  if (isStaffPhoneRequiredForProvisioning(role) && phoneE164) {
    await service.auth.admin.updateUserById(profileId, { phone: phoneE164, phone_confirm: true });
  }

  const manageableOutletIds =
    ctx.appRole === ROLES.SUPERADMIN
      ? await loadOrgOutletIdsForAssignment(supabase, branchSelection.primaryOutletId)
      : [...new Set(ctx.managedOutletIds)];

  const branchResult = await syncStaffProfileBranchAccess(supabase, {
    profileId,
    role,
    activeOutletIds: branchSelection.activeOutletIds,
    primaryOutletId: branchSelection.primaryOutletId,
    manageableOutletIds,
    assignedBy: ctx.user.id,
  });

  if (!branchResult.ok) {
    return { error: branchResult.message };
  }

  revalidatePath(ROUTES.dashboardStaff);
  revalidatePath(dashboardStaffAssignmentPath(branchResult.primaryAssignmentId));
  revalidatePath(ROUTES.dashboard);

  const branchNote =
    branchSelection.activeOutletIds.length > 1
      ? ` across ${branchSelection.activeOutletIds.length} branches`
      : "";

  return {
    success: `${fullName || email} is on the roster${branchNote}. Share the temporary password securely — they can change it after signing in.`,
    assignmentId: branchResult.primaryAssignmentId,
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

  if (!assignmentId) return { error: "Missing assignment." };

  const supabase = await createServerSupabaseClient();
  const { data: row, error: loadErr } = await supabase
    .from("staff_assignments")
    .select("id,outlet_id,profile_id,role")
    .eq("id", assignmentId)
    .is("revoked_at", null)
    .maybeSingle();

  if (loadErr || !row?.profile_id || !row.outlet_id) {
    return { error: "Assignment not found." };
  }
  if (!outletAllowedForInvite(ctx, row.outlet_id)) {
    return { error: "You cannot edit teammates at that branch." };
  }

  const role = String(row.role ?? "").trim() as AssignableStaffRole;
  if (!ASSIGNABLE_STRINGS.includes(role)) {
    return { error: "Unsupported role on this assignment." };
  }

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  let phoneE164: string | undefined;
  if (phoneRaw.length > 0) {
    const normalized = normalizeToE164(phoneRaw);
    if (!normalized.ok) {
      return { error: normalized.message };
    }
    phoneE164 = normalized.e164;
  }
  if (isStaffPhoneRequiredForProvisioning(role) && !phoneE164) {
    return { error: "Phone is required for reception and trainer roles (Phone OTP)." };
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
  await persistStaffProfileDisplay(service, row.profile_id, email, fullName, phoneE164, avatarUrl, ctx.user.id);

  if (isStaffPhoneRequiredForProvisioning(role) && phoneE164) {
    await service.auth.admin.updateUserById(row.profile_id, { phone: phoneE164, phone_confirm: true });
  }

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

  if (isStaffPhoneRequiredForProvisioning(role)) {
    const { data: prof } = await supabase.from("profiles").select("phone").eq("id", row.profile_id).maybeSingle();
    if (!prof?.phone?.trim()) {
      return {
        error:
          "Reception and trainer roles require a phone on the profile (Phone OTP). Open the profile editor and save a mobile number first.",
      };
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

/**
 * Sets which branches a teammate may access — one branch or many (e.g. org-wide branch admin).
 *
 * Form fields: `assignment_id`, `role`, `access_mode` (`single` | `multi`), `primary_outlet_id`,
 * `outlet_id` (single), or repeated `outlet_ids` (multi). See `syncStaffProfileBranchAccess`.
 */
export async function syncStaffBranchAssignmentsAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canManageStaffAssignments(ctx.appRole)) {
    return { error: "Only gym owners can change branch access." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as AssignableStaffRole;
  const branchSelection = parseStaffBranchFormSelection(formData);

  if (!assignmentId || !ASSIGNABLE_STRINGS.includes(role)) {
    return { error: "Role and branch access are required." };
  }
  if (!branchSelection.ok) {
    return { error: branchSelection.message };
  }

  const { activeOutletIds, primaryOutletId } = branchSelection;

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
    return { error: "You cannot edit this assignment." };
  }

  for (const outletId of activeOutletIds) {
    if (!outletAllowedForInvite(ctx, outletId)) {
      return { error: "You cannot assign one or more of those branches." };
    }
  }

  if (isStaffPhoneRequiredForProvisioning(role)) {
    const { data: prof } = await supabase.from("profiles").select("phone").eq("id", row.profile_id).maybeSingle();
    if (!prof?.phone?.trim()) {
      return {
        error:
          "Reception and trainer roles require a phone on the profile (Phone OTP). Save a mobile number in the profile section first.",
      };
    }
  }

  const manageableOutletIds =
    ctx.appRole === ROLES.SUPERADMIN
      ? await loadOrgOutletIdsForAssignment(supabase, row.outlet_id)
      : [...new Set(ctx.managedOutletIds)];

  const result = await syncStaffProfileBranchAccess(supabase, {
    profileId: row.profile_id,
    role,
    activeOutletIds,
    primaryOutletId,
    manageableOutletIds,
    assignedBy: ctx.user.id,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath(ROUTES.dashboardStaff);
  revalidatePath(dashboardStaffAssignmentPath(result.primaryAssignmentId));
  revalidatePath(dashboardStaffAssignmentPath(assignmentId));
  revalidatePath(ROUTES.dashboard);
  return { success: result.message };
}

/** Resolves every outlet in the same organization as `anchorOutletId` (superadmin branch sync). */
async function loadOrgOutletIdsForAssignment(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  anchorOutletId: string,
): Promise<string[]> {
  const { data: anchor } = await supabase
    .from("outlets")
    .select("organization_id")
    .eq("id", anchorOutletId)
    .maybeSingle();

  if (!anchor?.organization_id) return [anchorOutletId];

  const { data: rows } = await supabase
    .from("outlets")
    .select("id")
    .eq("organization_id", anchor.organization_id)
    .is("deleted_at", null);

  const ids = (rows ?? []).map((r) => r.id).filter(Boolean);
  return ids.length ? ids : [anchorOutletId];
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
