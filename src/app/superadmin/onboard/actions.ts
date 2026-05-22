"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { imageBlobFromFormDataEntry, uploadGymBrandLogoForOrganization } from "@/lib/supabase/gym-brand-logos-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { ROLES } from "@/types/roles";
import { ROUTES } from "@/utils/routes";
import { randomUUID } from "node:crypto";
import { slugifyOrganization } from "@/utils/slug";
import { sendGymOwnerWelcome } from "@/lib/email/send-welcome-emails";

/** Text fields echoed back after a failed submit (never includes password — user re-enters). */
export type OnboardGymFilledValues = {
  organization_name: string;
  slug: string;
  outlet_name: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  admin_full_name: string;
  admin_email: string;
};

export type OnboardGymFieldErrors = Partial<{
  organization_name: string;
  slug: string;
  outlet_name: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}>;

export type OnboardGymState = {
  error?: string;
  success?: string;
  /** Snapshot of submitted text fields — used by OnboardGymForm to refill after errors. */
  values?: OnboardGymFilledValues;
  /** Maps field `name`s to messages → red borders + inline text under that control. */
  fieldErrors?: OnboardGymFieldErrors;
  /**
   * Bumped whenever we return `values`; form uses `key={recoveryKey}` so remount picks up
   * `defaultValue`s (React resets uncontrolled fields after Server Action completion).
   */
  recoveryKey?: string;
};

function filledValuesFromFormData(formData: FormData): OnboardGymFilledValues {
  return {
    organization_name: String(formData.get("organization_name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    outlet_name: String(formData.get("outlet_name") ?? "").trim(),
    street_address: String(formData.get("street_address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    postal_code: String(formData.get("postal_code") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
    admin_full_name: String(formData.get("admin_full_name") ?? "").trim(),
    admin_email: String(formData.get("admin_email") ?? "").trim().toLowerCase(),
  };
}

/** Supabase Auth / common duplicate-registration copy — map to `admin_email` in OnboardGymForm. */
function isDuplicateAuthEmailMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    m.includes("email has already") ||
    m.includes("email address has already") ||
    (m.includes("duplicate") && (m.includes("email") || m.includes("users")))
  );
}

function errorRecovery(formData: FormData, patch: Omit<OnboardGymState, "values" | "recoveryKey">): OnboardGymState {
  return {
    ...patch,
    values: filledValuesFromFormData(formData),
    recoveryKey: randomUUID(),
  };
}

function isProfileEmailRpcMissing(error: { message?: string }): boolean {
  const m = (error.message ?? "").toLowerCase();
  return m.includes("schema cache") || m.includes("could not find the function");
}

/** User-facing hint when migration `003_profile_email_normalized_match.sql` was never applied / API cache stale. */
const PROFILE_EMAIL_RPC_SETUP_HINT =
  "Apply `supabase/migrations/003_profile_email_normalized_match.sql` in the Supabase SQL Editor (creates `public.profile_email_exists_normalized`). Then run: NOTIFY pgrst, 'reload schema';";

/**
 * Gym onboarding policy: the new gym admin must be a **new** Auth identity (unique email).
 * `profiles` is 1:1 with `auth.users` (see `handle_new_user` trigger in migrations).
 * Email match is **case-insensitive** and trims outer whitespace (`profile_email_exists_normalized` RPC
 * in migration `003_profile_email_normalized_match.sql`) so we align with Auth behaviour and avoid
 * missing mixed-case legacy rows vs `.eq(email, ...)`.
 *
 * We still run `createUser` later and handle duplicate races (e.g. parallel submits) with rollback.
 */
async function guardAdminEmailNotAlreadyRegistered(
  service: ReturnType<typeof createServiceRoleSupabaseClient>,
  formData: FormData,
  adminEmail: string,
): Promise<OnboardGymState | null> {
  const { data: exists, error } = await service.rpc("profile_email_exists_normalized", {
    p_email: adminEmail,
  });

  if (error) {
    if (isProfileEmailRpcMissing(error)) {
      return errorRecovery(formData, {
        error: `Could not verify admin email (${error.message}). ${PROFILE_EMAIL_RPC_SETUP_HINT}`,
      });
    }

    return errorRecovery(formData, {
      error: `Could not verify admin email: ${error.message}`,
    });
  }

  if (exists === true) {
    return errorRecovery(formData, {
      fieldErrors: {
        admin_email:
          "This email already has an account (matched case-insensitively). Use a different email for this gym’s administrator, or sign in as that user if they should manage this gym.",
      },
    });
  }

  return null;
}

function normalizeCountryCode(countryRaw: string): { ok: true; code: string } | { ok: false; message: string } {
  const raw = countryRaw.trim().toUpperCase();
  if (!raw) return { ok: true, code: "IN" };
  if (/^[A-Z]{2}$/.test(raw)) return { ok: true, code: raw };
  return { ok: false, message: "Country must be a 2-letter ISO code (e.g. IN), or leave blank for default IN." };
}

/**
 * Superadmin-only onboarding:
 * 0) **Before any tenant rows:** verify admin email is not already registered (RPC `profile_email_exists_normalized` — compares `lower(trim(email))`; see migration `003_profile_email_normalized_match.sql`).
 * 1) Inserts `organizations` (with `address_json`) + first branch (`outlets`) with mandatory address fields.
 *    `created_by` / `updated_by` are set by `022_audit_tracking` triggers from the superadmin session (`auth.uid()`).
 * 2) Optionally uploads a brand logo to Storage (`gym-brand-logos` bucket) and sets `organizations.logo_url`
 *    — see `uploadGymBrandLogoForOrganization` in `@/lib/supabase/gym-brand-logos-storage`.
 * 3) Creates the gym admin auth user via **Admin API** (service role) — never callable from the browser.
 * 4) Inserts `staff_assignments` with role **`gym_owner`** (not branch_admin) so org-wide branch expansion + RLS align; additional branches use `syncGymOwnerAssignmentsForOutlet`.
 * 5) Sends a welcome email (`sendGymOwnerWelcome` → Resend), if env is configured (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Same logic as a future `POST /api/onboard-gym`.
 * On success: redirects to All gyms (`?toast=gym-created`); {@link SuperadminFlashBanner} shows the message.
 */
export async function onboardGymAction(
  _prev: OnboardGymState,
  formData: FormData,
): Promise<OnboardGymState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Forbidden: superadmin only." };
  }

  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const outletName = String(formData.get("outlet_name") ?? "").trim();
  const streetAddress = String(formData.get("street_address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const countryRaw = String(formData.get("country") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();

  const adminEmail = String(formData.get("admin_email") ?? "").trim().toLowerCase();
  const adminPassword = String(formData.get("admin_password") ?? "");
  const adminFullName = String(formData.get("admin_full_name") ?? "").trim();

  const countryResult = normalizeCountryCode(countryRaw);
  if (!countryResult.ok) {
    return errorRecovery(formData, {
      fieldErrors: { country: countryResult.message },
    });
  }
  const countryEffective = countryResult.code;

  if (!organizationName || !outletName || !adminEmail || !adminPassword) {
    return errorRecovery(formData, {
      error: "Organization, outlet, admin email, and admin password are required.",
    });
  }
  if (!streetAddress || !city || !state || !postalCode) {
    return errorRecovery(formData, {
      error: "Street address, city, state, postal code, and ISO country code are required for the first branch.",
    });
  }

  const slug = slugInput ? slugifyOrganization(slugInput) : slugifyOrganization(organizationName);

  const admin = createServiceRoleSupabaseClient();
  const emailBlocked = await guardAdminEmailNotAlreadyRegistered(admin, formData, adminEmail);
  if (emailBlocked) {
    return emailBlocked;
  }

  const supabase = await createServerSupabaseClient();

  const addressJson = {
    street: streetAddress,
    city,
    state,
    country: countryEffective,
    zip: postalCode,
  };

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: organizationName,
      slug,
      contact_email: adminEmail,
      address_json: addressJson,
    })
    .select("id, name, plan_tier")
    .single();

  if (orgError) {
    const msg = orgError.message;
    const likelySlugConflict =
      /duplicate|unique|violates/i.test(msg) &&
      (/slug/i.test(msg) || /organizations/i.test(msg) || /uniq/i.test(msg));

    return errorRecovery(
      formData,
      likelySlugConflict ? { fieldErrors: { slug: msg } } : { error: msg },
    );
  }

  const brandLogo = imageBlobFromFormDataEntry(formData.get("brand_logo"));
  if (brandLogo) {
    const uploaded = await uploadGymBrandLogoForOrganization(admin, org.id, brandLogo);
    if (!uploaded.ok) {
      return errorRecovery(formData, { error: uploaded.message });
    }
    const { error: logoUrlError } = await supabase
      .from("organizations")
      .update({ logo_url: uploaded.publicUrl })
      .eq("id", org.id);
    if (logoUrlError) {
      return errorRecovery(formData, {
        error: `Logo uploaded but could not save URL: ${logoUrlError.message}`,
      });
    }
  }

  const { data: outlet, error: outletError } = await supabase
    .from("outlets")
    .insert({
      organization_id: org.id,
      name: outletName,
      address: streetAddress,
      city,
      state,
      country: countryEffective,
    })
    .select("id, name")
    .single();

  if (outletError) {
    await admin.from("organizations").delete().eq("id", org.id);
    return errorRecovery(formData, { error: outletError.message });
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminFullName || adminEmail },
  });

  if (authError || !created.user) {
    const msg = authError?.message ?? "Failed to create gym admin user.";
    await admin.from("outlets").delete().eq("id", outlet.id);
    await admin.from("organizations").delete().eq("id", org.id);

    const duplicateEmail = isDuplicateAuthEmailMessage(msg);
    return errorRecovery(
      formData,
      duplicateEmail ? { fieldErrors: { admin_email: msg } } : { error: msg },
    );
  }

  const { error: staffError } = await supabase.from("staff_assignments").insert({
    profile_id: created.user.id,
    outlet_id: outlet.id,
    role: ROLES.GYM_OWNER,
    is_primary: true,
  });

  if (staffError) {
    return errorRecovery(formData, {
      error: `${staffError.message} (Auth user was created; you may need to clean up in Supabase Dashboard.)`,
    });
  }

  try {
    const ownerDisplayName =
      adminFullName.trim() ||
      (adminEmail.includes("@") ? adminEmail.slice(0, adminEmail.indexOf("@")) : adminEmail);
    await sendGymOwnerWelcome({
      gymName: org.name,
      orgId: org.id,
      outletCity: city,
      outletName: outlet.name,
      ownerEmail: adminEmail,
      ownerName: ownerDisplayName,
      planTier: org.plan_tier,
    });
  } catch (welcomeErr) {
    console.error("[email] Gym owner welcome after onboard:", welcomeErr);
  }

  revalidatePath(ROUTES.superadmin);
  revalidatePath(ROUTES.superadminGyms);

  redirect(`${ROUTES.superadminGyms}?toast=gym-created&page=1`);
}
