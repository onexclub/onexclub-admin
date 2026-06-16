"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyTemporaryAuthPassword } from "@/lib/auth/temporary-auth-password";
import {
  imageBlobFromFormDataEntry,
  removeGymBrandLogoObjectsForOrganization,
  uploadGymBrandLogoForOrganization,
} from "@/lib/supabase/gym-brand-logos-storage";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { auditActorOnUpdate } from "@/lib/supabase/audit-columns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROLES } from "@/types/roles";
import { ROUTES } from "@/utils/routes";
import { slugifyOrganization } from "@/utils/slug";
import { syncGymOwnerAssignmentsForOutlet } from "@/lib/superadmin/sync-gym-owner-branch-assignments";

export async function setOrganizationActiveAction(formData: FormData) {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    throw new Error("Forbidden");
  }

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("is_active") ?? "");
  if (!id || (next !== "true" && next !== "false")) {
    throw new Error("Invalid payload");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("organizations").update({ is_active: next === "true" }).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${id}`);
  revalidatePath(ROUTES.superadmin);
}

/** Same rules as onboarding: blank country → IN; otherwise strict ISO alpha-2. */
function normalizeCountryCode(countryRaw: string): { ok: true; code: string } | { ok: false; message: string } {
  const raw = countryRaw.trim().toUpperCase();
  if (!raw) return { ok: true, code: "IN" };
  if (/^[A-Z]{2}$/.test(raw)) return { ok: true, code: raw };
  return { ok: false, message: "Country must be a 2-letter ISO code (e.g. IN), or leave blank for default IN." };
}

export type AddBranchState = {
  error?: string;
};

/**
 * Inserts a gym branch (`outlets` row), then links every org `gym_owner` to that outlet via
 * `staff_assignments` (see `syncGymOwnerAssignmentsForOutlet` — keeps `my_staff_outlet_ids` aligned
 * with org-wide owner visibility).
 */
export async function addBranchAction(_prev: AddBranchState, formData: FormData): Promise<AddBranchState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Forbidden: superadmin only." };
  }

  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const branchName = String(formData.get("branch_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const countryRaw = String(formData.get("country") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const countryResult = normalizeCountryCode(countryRaw);
  if (!countryResult.ok) {
    return { error: countryResult.message };
  }

  if (!organizationId || !branchName || !address || !city || !state) {
    return { error: "Branch name, street address, city, and state are required." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: createdOutlet, error } = await supabase
    .from("outlets")
    .insert({
      organization_id: organizationId,
      name: branchName,
      address,
      city,
      state,
      country: countryResult.code,
      phone: phone || null,
    })
    .select("id")
    .single();

  if (error || !createdOutlet?.id) {
    return { error: error?.message ?? "Could not create branch." };
  }

  const linked = await syncGymOwnerAssignmentsForOutlet(supabase, organizationId, createdOutlet.id);
  if (!linked.ok) {
    await supabase.from("outlets").delete().eq("id", createdOutlet.id);
    return { error: `Branch was not saved: could not link gym owners — ${linked.message}` };
  }

  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}`);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}/branches/new`);
  revalidatePath(ROUTES.superadmin);

  redirect(`${ROUTES.superadminGyms}/${organizationId}?toast=branch-created`);
}

export type UpdateBranchState = {
  error?: string;
};

/**
 * Updates outlet fields from the branch edit screen. After a successful save, re-syncs org `gym_owner`
 * rows to this outlet (repairs legacy branches created before owner linking — see `syncGymOwnerAssignmentsForOutlet`).
 */
export async function updateBranchAction(_prev: UpdateBranchState, formData: FormData): Promise<UpdateBranchState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Forbidden: superadmin only." };
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const branchName = String(formData.get("branch_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const countryRaw = String(formData.get("country") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "true") === "true";

  const countryResult = normalizeCountryCode(countryRaw);
  if (!countryResult.ok) {
    return { error: countryResult.message };
  }

  if (!outletId || !organizationId || !branchName || !address || !city || !state) {
    return { error: "Branch name, street address, city, and state are required." };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("outlets")
    .update({
      name: branchName,
      address,
      city,
      state,
      country: countryResult.code,
      phone: phone || null,
      email: email || null,
      is_active: isActive,
    })
    .eq("id", outletId)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: error.message };
  }

  const linked = await syncGymOwnerAssignmentsForOutlet(supabase, organizationId, outletId);
  if (!linked.ok) {
    return { error: `Branch saved, but gym owner links failed — ${linked.message}` };
  }

  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}`);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}/branches/${outletId}/edit`);
  revalidatePath(ROUTES.superadmin);

  redirect(`${ROUTES.superadminGyms}/${organizationId}?toast=branch-updated`);
}

export type UpdateOrganizationState = {
  error?: string;
};

/**
 * Updates `organizations.name`, `organizations.slug`, and optionally `organizations.logo_url` (Storage upload /
 * removal). Superadmin-only; mirrors onboarding logo rules (`gym-brand-logos` bucket).
 */
export async function updateOrganizationAction(
  _prev: UpdateOrganizationState,
  formData: FormData,
): Promise<UpdateOrganizationState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Forbidden: superadmin only." };
  }

  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const clearLogo = String(formData.get("clear_logo") ?? "") === "on";
  const brandLogoFile = imageBlobFromFormDataEntry(formData.get("brand_logo"));

  if (!organizationId || !organizationName) {
    return { error: "Organization id and name are required." };
  }

  const slug = slugRaw ? slugifyOrganization(slugRaw) : slugifyOrganization(organizationName);

  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleSupabaseClient();

  const { data: current, error: readErr } = await supabase
    .from("organizations")
    .select("id,slug")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readErr) {
    return { error: readErr.message };
  }
  if (!current) {
    return { error: "Organization not found." };
  }

  const { data: slugOwner, error: slugErr } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();

  if (slugErr) {
    return { error: slugErr.message };
  }
  if (slugOwner && String(slugOwner.id) !== organizationId) {
    return { error: `Slug "${slug}" is already taken by another organization.` };
  }

  let logoUrl: string | null | undefined;

  if (brandLogoFile) {
    const cleaned = await removeGymBrandLogoObjectsForOrganization(admin, organizationId);
    if (!cleaned.ok) {
      return { error: cleaned.message };
    }
    const uploaded = await uploadGymBrandLogoForOrganization(admin, organizationId, brandLogoFile);
    if (!uploaded.ok) {
      return { error: uploaded.message };
    }
    logoUrl = uploaded.publicUrl;
  } else if (clearLogo) {
    const cleared = await removeGymBrandLogoObjectsForOrganization(admin, organizationId);
    if (!cleared.ok) {
      return { error: cleared.message };
    }
    logoUrl = null;
  }

  const patch: { name: string; slug: string; logo_url?: string | null } = {
    name: organizationName,
    slug,
  };
  if (logoUrl !== undefined) {
    patch.logo_url = logoUrl;
  }

  const { error: upErr } = await supabase.from("organizations").update(patch).eq("id", organizationId);
  if (upErr) {
    return { error: upErr.message };
  }

  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}`);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}/edit`);
  revalidatePath(ROUTES.superadmin);

  redirect(`${ROUTES.superadminGyms}/${organizationId}?toast=org-updated`);
}

export type ReassignGymOwnerState = {
  error?: string;
  success?: string;
};

/**
 * Replaces org-wide `gym_owner` assignments: revokes existing owner rows on every branch,
 * then links the new (or existing) profile across all outlets (`syncGymOwnerAssignmentsForOutlet`).
 *
 * **Reuse:** Same Auth + `staff_assignments` pattern as `onboardGymAction` — superadmin-only.
 */
export async function reassignGymOwnerAction(
  _prev: ReassignGymOwnerState,
  formData: FormData,
): Promise<ReassignGymOwnerState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Forbidden: superadmin only." };
  }

  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim().toLowerCase();
  const ownerFullName = String(formData.get("owner_full_name") ?? "").trim();
  const ownerPassword = String(formData.get("owner_password") ?? "");

  if (!organizationId || !ownerEmail) {
    return { error: "Organization and owner email are required." };
  }

  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleSupabaseClient();

  const { data: outlets } = await supabase
    .from("outlets")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const outletIds = (outlets ?? []).map((o) => o.id).filter(Boolean);
  if (!outletIds.length) {
    return { error: "This organization has no branches yet. Add a branch before assigning an owner." };
  }

  const primaryOutletId = outletIds[0]!;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,email")
    .is("deleted_at", null)
    .ilike("email", ownerEmail)
    .maybeSingle();

  let profileId = existingProfile?.id as string | undefined;

  if (!profileId) {
    if (!ownerPassword || ownerPassword.trim().length < 8) {
      return { error: "Temporary password (min 8 characters) is required when creating a new owner account." };
    }
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword.trim(),
      email_confirm: true,
      user_metadata: { full_name: ownerFullName || ownerEmail },
    });
    if (authError || !created.user) {
      return { error: authError?.message ?? "Failed to create owner account." };
    }
    profileId = created.user.id;
    await admin
      .from("profiles")
      .update({
        full_name: ownerFullName || ownerEmail,
        email: ownerEmail,
        ...auditActorOnUpdate(ctx.user.id),
      })
      .eq("id", profileId);
  } else {
    if (ownerFullName) {
      await admin
        .from("profiles")
        .update({ full_name: ownerFullName, ...auditActorOnUpdate(ctx.user.id) })
        .eq("id", profileId);
    }
    if (ownerPassword.trim()) {
      const passwordResult = await applyTemporaryAuthPassword(admin, profileId, ownerPassword);
      if (!passwordResult.ok) {
        return { error: passwordResult.message };
      }
    }
  }

  const now = new Date().toISOString();
  const { error: revokeErr } = await supabase
    .from("staff_assignments")
    .update({ revoked_at: now })
    .eq("role", ROLES.GYM_OWNER)
    .is("revoked_at", null)
    .in("outlet_id", outletIds);

  if (revokeErr) {
    return { error: `Could not revoke previous owner(s): ${revokeErr.message}` };
  }

  const { error: primaryErr } = await supabase.from("staff_assignments").upsert(
    {
      profile_id: profileId,
      outlet_id: primaryOutletId,
      role: ROLES.GYM_OWNER,
      is_primary: true,
      revoked_at: null,
    },
    { onConflict: "profile_id,outlet_id" },
  );

  if (primaryErr) {
    return { error: `Could not assign owner on primary branch: ${primaryErr.message}` };
  }

  for (const outletId of outletIds) {
    if (outletId === primaryOutletId) continue;
    const linked = await syncGymOwnerAssignmentsForOutlet(supabase, organizationId, outletId);
    if (!linked.ok) {
      return { error: `Owner assigned on primary branch but linking failed: ${linked.message}` };
    }
  }

  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}`);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}/edit`);

  return { success: "Gym owner updated and linked to all branches." };
}
