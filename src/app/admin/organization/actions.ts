"use server";

import { revalidatePath } from "next/cache";
import type { GymAddressJson } from "@/lib/admin/gym-organization-shared";
import {
  closureEntriesToExceptionRows,
  weeklyScheduleToOutletHourRows,
} from "@/lib/outlets/outlet-hours-db";
import {
  isValidTimeHHmm,
  mergeOutletClosures,
  normalizeTimeToHHmm,
  parseHolidayLines,
  validateWeeklySchedule,
  WEEKDAY_KEYS,
  type DayHours,
  type OutletClosureEntry,
  type ScheduleFormPayload,
  type WeekdayKey,
} from "@/lib/outlets/schedule";
import {
  imageBlobFromFormDataEntry,
  removeGymBrandLogoObjectsForOrganization,
  uploadGymBrandLogoForOrganization,
} from "@/lib/supabase/gym-brand-logos-storage";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOutletForBranchAdmin, effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { canWrite, ROLES } from "@/lib/auth/roles";
import { ROUTES } from "@/utils/routes";

export type GymSettingsActionState = { error?: string; success?: string };

function revalidateGymSettingsPaths() {
  revalidatePath(ROUTES.adminOrganization, "page");
  revalidatePath(ROUTES.dashboardBranches, "page");
  revalidatePath(ROUTES.admin, "page");
  revalidatePath(ROUTES.dashboard, "page");
  /** Sidebar rail reads `loadGymOrganizationForAdminDashboard` in `admin/layout` + `dashboard/layout`. */
  revalidatePath(ROUTES.admin, "layout");
  revalidatePath(ROUTES.dashboard, "layout");
}

/**
 * Gym owners may only update branding for an organisation they manage (via any outlet in scope).
 * Superadmins bypass (platform console use).
 */
async function assertMayEditOrganizationBranding(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  ctx: Awaited<ReturnType<typeof getAuthDashboardContext>>,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (ctx.appRole === ROLES.SUPERADMIN) return { ok: true };
  const outletIds = effectiveManagedOutletIds(ctx);
  if (!outletIds.length) return { ok: false, message: "No branch scope for this account." };
  const { data, error } = await supabase
    .from("outlets")
    .select("id")
    .in("id", outletIds)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(1);
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "You cannot edit this organisation." };
  return { ok: true };
}

/**
 * Gym HQ brand logo only (`gym-brand-logos` bucket).
 *
 * **Reuse:** Keep this separate from `updateGymOrganizationProfileAction` — a dedicated multipart payload avoids hitting
 * the default 1MB Server Action limit when HQ text fields grow, and makes failures obvious when Storage is empty.
 */
export async function uploadGymOrganizationBrandLogoAction(
  _prev: GymSettingsActionState,
  formData: FormData,
): Promise<GymSettingsActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) return { error: "Sign in required." };
  if (ctx.appRole !== ROLES.GYM_OWNER && ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Only gym owners and superadmins can change organisation branding." };
  }

  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const clearLogo = String(formData.get("clear_logo") ?? "") === "on";
  const brandLogo = imageBlobFromFormDataEntry(formData.get("brand_logo"));

  if (!organizationId) {
    return { error: "Organisation id is required." };
  }

  const supabase = await createServerSupabaseClient();
  const scope = await assertMayEditOrganizationBranding(supabase, ctx, organizationId);
  if (!scope.ok) return { error: scope.message };

  if (!brandLogo && !clearLogo) {
    return { error: "Select a logo image, or check remove logo." };
  }

  const admin = createServiceRoleSupabaseClient();
  let logoUrl: string | null;

  if (brandLogo) {
    const cleaned = await removeGymBrandLogoObjectsForOrganization(admin, organizationId);
    if (!cleaned.ok) return { error: cleaned.message };
    const uploaded = await uploadGymBrandLogoForOrganization(admin, organizationId, brandLogo);
    if (!uploaded.ok) return { error: uploaded.message };
    logoUrl = uploaded.publicUrl;
  } else {
    const cleared = await removeGymBrandLogoObjectsForOrganization(admin, organizationId);
    if (!cleared.ok) return { error: cleared.message };
    logoUrl = null;
  }

  const { error } = await supabase.from("organizations").update({ logo_url: logoUrl }).eq("id", organizationId);
  if (error) return { error: error.message };

  revalidateGymSettingsPaths();
  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}`);
  return { success: "Brand logo updated." };
}

/** Gym owners may update HQ brand text fields on `organizations` (RLS: `gym_owner_orgs_update`). Logo: `uploadGymOrganizationBrandLogoAction`. */
export async function updateGymOrganizationProfileAction(
  _prev: GymSettingsActionState,
  formData: FormData,
): Promise<GymSettingsActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user) return { error: "Sign in required." };
  if (ctx.appRole !== ROLES.GYM_OWNER && ctx.appRole !== ROLES.SUPERADMIN) {
    return { error: "Only gym owners can edit organisation branding and HQ contact." };
  }

  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const name = String(formData.get("organization_name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const zip = String(formData.get("postal_code") ?? "").trim();
  const country = String(formData.get("country") ?? "IN").trim().toUpperCase() || "IN";
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();

  if (!organizationId || !name) {
    return { error: "Organisation id and name are required." };
  }

  const address_json: GymAddressJson = {
    street: street || undefined,
    city: city || undefined,
    state: state || undefined,
    zip: zip || undefined,
    country: country.length === 2 ? country : "IN",
  };

  const supabase = await createServerSupabaseClient();
  const scope = await assertMayEditOrganizationBranding(supabase, ctx, organizationId);
  if (!scope.ok) return { error: scope.message };

  const patch: {
    name: string;
    address_json: GymAddressJson;
    contact_email: string | null;
    contact_phone: string | null;
  } = {
    name,
    address_json,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
  };

  const { error } = await supabase.from("organizations").update(patch).eq("id", organizationId);

  if (error) return { error: error.message };

  revalidateGymSettingsPaths();
  revalidatePath(ROUTES.superadminGyms);
  revalidatePath(`${ROUTES.superadminGyms}/${organizationId}`);
  return { success: "Organisation profile saved." };
}

function outletAllowed(ctx: Awaited<ReturnType<typeof getAuthDashboardContext>>, outletId: string) {
  if (ctx.appRole === ROLES.SUPERADMIN) return true;
  return canManageOutletForBranchAdmin(ctx, outletId) || ctx.managedOutletIds.includes(outletId);
}

/** Branch address + contact — `canWrite(..., "branches")` (owners + branch admins). */
export async function updateOutletBranchProfileAction(
  _prev: GymSettingsActionState,
  formData: FormData,
): Promise<GymSettingsActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canWrite(ctx.appRole, "branches")) {
    return { error: "You cannot edit branch details." };
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const name = String(formData.get("branch_name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const countryRaw = String(formData.get("country") ?? "").trim().toUpperCase();
  const country = countryRaw.length === 2 ? countryRaw : "IN";
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!outletId || !name) return { error: "Branch id and name are required." };
  if (!outletAllowed(ctx, outletId)) return { error: "That branch is outside your scope." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("outlets")
    .update({
      name,
      address: address || null,
      city: city || null,
      state: state || null,
      country,
      phone: phone || null,
      email: email || null,
    })
    .eq("id", outletId);

  if (error) return { error: error.message };

  revalidateGymSettingsPaths();
  return { success: "Branch profile saved." };
}

type ParsedOutletSchedule = {
  weekly: Partial<Record<WeekdayKey, DayHours>>;
  closures: OutletClosureEntry[];
};

function timeOrderOk(open: string, close: string): boolean {
  return open < close;
}

/**
 * Parses schedule from `schedule_json` (preferred) or legacy per-day FormData fields.
 * **Reuse:** `updateOutletScheduleAction` only.
 */
function parseScheduleFromFormData(
  formData: FormData,
): { ok: true; data: ParsedOutletSchedule } | { ok: false; error: string } {
  const jsonRaw = String(formData.get("schedule_json") ?? "").trim();
  if (jsonRaw) {
    try {
      const payload = JSON.parse(jsonRaw) as ScheduleFormPayload;
      const validated = validateWeeklySchedule(payload.weekly ?? {});
      if (!validated.ok) return { ok: false, error: validated.error };

      const datedClosures = parseHolidayLines(String(payload.holidays_lines ?? ""));
      const preserved = Array.isArray(payload.preserved_weekday_closures)
        ? payload.preserved_weekday_closures.filter((row): row is OutletClosureEntry => {
            if (!row || typeof row !== "object" || !("weekday" in row)) return false;
            const w = (row as { weekday?: string }).weekday;
            return Boolean(w && WEEKDAY_KEYS.includes(w as WeekdayKey));
          })
        : [];

      return {
        ok: true,
        data: { weekly: validated.weekly, closures: mergeOutletClosures(datedClosures, preserved) },
      };
    } catch {
      return { ok: false, error: "Invalid schedule data — refresh and try again." };
    }
  }

  return parseOutletScheduleFromFormData(formData);
}
/** Legacy parser — individual `${day}_open` fields (kept for backwards compatibility). */
function parseOutletScheduleFromFormData(formData: FormData): { ok: true; data: ParsedOutletSchedule } | { ok: false; error: string } {
  const weekly: Partial<Record<WeekdayKey, DayHours>> = {};
  for (const day of WEEKDAY_KEYS) {
    const closed = formData.get(`${day}_closed`) === "on";
    const is24 = formData.get(`${day}_24h`) === "on";
    const open = normalizeTimeToHHmm(String(formData.get(`${day}_open`) ?? ""));
    const close = normalizeTimeToHHmm(String(formData.get(`${day}_close`) ?? ""));
    const open2 = normalizeTimeToHHmm(String(formData.get(`${day}_open2`) ?? ""));
    const close2 = normalizeTimeToHHmm(String(formData.get(`${day}_close2`) ?? ""));

    if (closed && is24) {
      return { ok: false, error: `${day}: choose either closed or 24 hours, not both.` };
    }
    if (closed) {
      weekly[day] = { closed: true };
      continue;
    }
    if (is24) {
      weekly[day] = { is_24_hours: true };
      continue;
    }

    if (open && !isValidTimeHHmm(open)) {
      return { ok: false, error: `${day}: open time must be valid (24-hour).` };
    }
    if (close && !isValidTimeHHmm(close)) {
      return { ok: false, error: `${day}: close time must be valid (24-hour).` };
    }
    if (open2 && !isValidTimeHHmm(open2)) {
      return { ok: false, error: `${day}: evening open time must be valid (24-hour).` };
    }
    if (close2 && !isValidTimeHHmm(close2)) {
      return { ok: false, error: `${day}: evening close time must be valid (24-hour).` };
    }

    if (open && close) {
      if (!timeOrderOk(open, close)) {
        return { ok: false, error: `${day}: close time must be after open time (same-day schedule).` };
      }
      const d: DayHours = { open, close };
      if (open2 || close2) {
        if (!open2 || !close2) {
          return { ok: false, error: `${day}: evening shift needs both open and close.` };
        }
        if (!timeOrderOk(open2, close2)) {
          return { ok: false, error: `${day}: evening close must be after evening open.` };
        }
        d.shift2_open = open2;
        d.shift2_close = close2;
      }
      weekly[day] = d;
      continue;
    }

    if (open2 || close2) {
      return { ok: false, error: `${day}: set morning hours before adding an evening shift.` };
    }
  }

  const datedClosures = parseHolidayLines(String(formData.get("holidays_lines") ?? ""));
  const preservedRaw = String(formData.get("preserved_weekday_closures") ?? "").trim();
  let preservedWeekday: OutletClosureEntry[] = [];
  if (preservedRaw) {
    try {
      const parsed = JSON.parse(preservedRaw) as unknown;
      if (Array.isArray(parsed)) {
        preservedWeekday = parsed.filter((row): row is OutletClosureEntry => {
          if (!row || typeof row !== "object" || !("weekday" in row)) return false;
          const w = (row as { weekday?: string }).weekday;
          return Boolean(w && WEEKDAY_KEYS.includes(w as WeekdayKey));
        });
      }
    } catch {
      preservedWeekday = [];
    }
  }

  return { ok: true, data: { weekly, closures: mergeOutletClosures(datedClosures, preservedWeekday) } };
}

/** Writes weekly rows + dated exceptions for one outlet (replaces existing schedule). */
async function persistOutletSchedule(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  outletId: string,
  schedule: ParsedOutletSchedule,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { weekly, closures } = schedule;

  const hourRows = weeklyScheduleToOutletHourRows(outletId, weekly);
  if (!hourRows.length) {
    return { ok: false, error: "Set at least one open day with hours before saving." };
  }

  const { error: delHoursErr } = await supabase.from("outlet_hours").delete().eq("outlet_id", outletId);
  if (delHoursErr) return { ok: false, error: delHoursErr.message };

  const { error: insHoursErr } = await supabase.from("outlet_hours").insert(hourRows);
  if (insHoursErr) return { ok: false, error: insHoursErr.message };

  const { error: delExcErr } = await supabase.from("outlet_hour_exceptions").delete().eq("outlet_id", outletId);
  if (delExcErr) return { ok: false, error: delExcErr.message };

  const datedOnly = closures.filter((c): c is OutletClosureEntry & { date: string } => Boolean(c.date));
  const excRows = closureEntriesToExceptionRows(outletId, datedOnly);
  if (excRows.length) {
    const { error: insExcErr } = await supabase.from("outlet_hour_exceptions").insert(excRows);
    if (insExcErr) return { ok: false, error: insExcErr.message };
  }

  return { ok: true };
}

/** Weekly hours → `outlet_hours`; dated lines → `outlet_hour_exceptions` (see migration `019_outlet_hours_tables.sql`). */
export async function updateOutletScheduleAction(
  _prev: GymSettingsActionState,
  formData: FormData,
): Promise<GymSettingsActionState> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !canWrite(ctx.appRole, "branches")) {
    return { error: "You cannot edit operating hours." };
  }

  const outletId = String(formData.get("outlet_id") ?? "").trim();

  if (!outletId) return { error: "Branch id is required." };
  if (!outletAllowed(ctx, outletId)) return { error: "That branch is outside your scope." };

  const parsed = parseScheduleFromFormData(formData);
  if (!parsed.ok) return { error: parsed.error };

  const applyToAll = String(formData.get("apply_to_all_branches") ?? "") === "on";
  let targetOutletIds = [outletId];
  if (applyToAll) {
    const raw = String(formData.get("all_outlet_ids") ?? "").trim();
    try {
      const ids = JSON.parse(raw) as unknown;
      if (!Array.isArray(ids)) return { error: "Invalid branch list." };
      targetOutletIds = ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    } catch {
      return { error: "Invalid branch list." };
    }
    if (!targetOutletIds.length) return { error: "No branches selected." };
    for (const id of targetOutletIds) {
      if (!outletAllowed(ctx, id)) return { error: "One or more branches are outside your scope." };
    }
  }

  const supabase = await createServerSupabaseClient();
  for (const id of targetOutletIds) {
    const saved = await persistOutletSchedule(supabase, id, parsed.data);
    if (!saved.ok) return { error: saved.error };
  }

  revalidateGymSettingsPaths();
  if (applyToAll && targetOutletIds.length > 1) {
    return { success: `Hours and holidays saved for ${targetOutletIds.length} branches.` };
  }
  return { success: "Hours and holiday exceptions saved." };
}

/** @deprecated Use `updateOutletScheduleAction` with `apply_to_all_branches` instead. */
export async function updateAllOutletsScheduleAction(
  prev: GymSettingsActionState,
  formData: FormData,
): Promise<GymSettingsActionState> {
  formData.set("apply_to_all_branches", "on");
  return updateOutletScheduleAction(prev, formData);
}
