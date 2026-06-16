/**
 * Floating customer lookup — match by phone (primary) or email before onboarding.
 *
 * **Reuse:**
 * - `lookupExistingCustomerAction` (onboard wizard step 0)
 * - `updateCustomerProfileAction` (duplicate contact guard on edit — no lookup modal)
 *
 * **DB:** migration `024_customer_lookup.sql` (`find_existing_customer`, `profile_*_taken_by_other`).
 * Moderate together with `003_profile_email_normalized_match.sql`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeToE164, phoneDigitsForComparison } from "@/lib/auth/phone-e164";
import { toUserFacingError } from "@/lib/errors/user-facing";
import type { ProfileGender } from "@/lib/profile/vitals";

export type CustomerGymHistoryEntry = {
  membership_id: string;
  outlet_id: string;
  organization_id: string | null;
  gym_name: string | null;
  branch: string | null;
  city: string | null;
  organization_name: string | null;
  plan: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export type ExistingCustomerMatch = {
  found: true;
  profile_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  bmi: number | null;
  gender: ProfileGender | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  member_since: string | null;
  gym_history: CustomerGymHistoryEntry[];
};

export type ExistingCustomerLookupResult = { found: false } | ExistingCustomerMatch;

function parseGymHistory(raw: unknown): CustomerGymHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
    .map((row) => ({
      membership_id: String(row.membership_id ?? ""),
      outlet_id: String(row.outlet_id ?? ""),
      organization_id: typeof row.organization_id === "string" ? row.organization_id : null,
      gym_name: typeof row.gym_name === "string" ? row.gym_name : null,
      branch: typeof row.branch === "string" ? row.branch : null,
      city: typeof row.city === "string" ? row.city : null,
      organization_name: typeof row.organization_name === "string" ? row.organization_name : null,
      plan: typeof row.plan === "string" ? row.plan : null,
      status: String(row.status ?? ""),
      start_date: typeof row.start_date === "string" ? row.start_date : null,
      end_date: typeof row.end_date === "string" ? row.end_date : null,
      is_active: Boolean(row.is_active),
    }))
    .filter((row) => row.membership_id.length > 0);
}

function parseLookupRpcPayload(raw: unknown): ExistingCustomerLookupResult {
  if (raw == null || typeof raw !== "object") return { found: false };
  const row = raw as Record<string, unknown>;
  if (!row.found) return { found: false };

  const profileId = typeof row.profile_id === "string" ? row.profile_id : "";
  if (!profileId) return { found: false };

  const genderRaw = row.gender;
  const gender =
    typeof genderRaw === "string" && genderRaw.length
      ? (genderRaw as ProfileGender)
      : null;

  return {
    found: true,
    profile_id: profileId,
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    email: typeof row.email === "string" ? row.email : null,
    bmi: typeof row.bmi === "number" ? row.bmi : row.bmi != null ? Number(row.bmi) : null,
    gender,
    date_of_birth: typeof row.date_of_birth === "string" ? row.date_of_birth : null,
    height_cm: typeof row.height_cm === "number" ? row.height_cm : row.height_cm != null ? Number(row.height_cm) : null,
    weight_kg: typeof row.weight_kg === "number" ? row.weight_kg : row.weight_kg != null ? Number(row.weight_kg) : null,
    member_since: typeof row.member_since === "string" ? row.member_since : null,
    gym_history: parseGymHistory(row.gym_history),
  };
}

/** Server-side lookup before onboarding — requires service_role client. */
export async function findExistingCustomer(
  service: SupabaseClient,
  input: { phone?: string; email?: string },
): Promise<ExistingCustomerLookupResult> {
  const phoneRaw = input.phone?.trim() ?? "";
  const emailRaw = input.email?.trim().toLowerCase() ?? "";

  let phoneForRpc: string | null = null;
  if (phoneRaw.length > 0) {
    const normalized = normalizeToE164(phoneRaw);
    if (!normalized.ok) {
      throw new Error(normalized.message);
    }
    phoneForRpc = normalized.e164;
  }

  const emailForRpc = emailRaw.length > 0 ? emailRaw : null;
  if (!phoneForRpc && !emailForRpc) {
    return { found: false };
  }

  const { data, error } = await service.rpc("find_existing_customer", {
    p_phone: phoneForRpc,
    p_email: emailForRpc,
  });

  if (error) {
    throw new Error(toUserFacingError(error, "Could not search for an existing member."));
  }

  return parseLookupRpcPayload(data);
}

export type ContactConflict = {
  phoneTaken: boolean;
  emailTaken: boolean;
};

/**
 * Profile edit guard — returns which contact fields belong to another account.
 * Does **not** run during onboarding (use {@link findExistingCustomer} + link flow instead).
 */
export async function contactTakenByOtherProfile(
  service: SupabaseClient,
  input: {
    profileId: string;
    phoneRaw?: string;
    emailRaw?: string;
  },
): Promise<ContactConflict> {
  const phoneRaw = input.phoneRaw?.trim() ?? "";
  const emailRaw = input.emailRaw?.trim().toLowerCase() ?? "";

  let phoneTaken = false;
  let emailTaken = false;

  if (phoneRaw.length > 0) {
    const normalized = normalizeToE164(phoneRaw);
    if (!normalized.ok) {
      throw new Error(normalized.message);
    }
    const { data, error } = await service.rpc("profile_phone_taken_by_other", {
      p_phone: normalized.e164,
      p_exclude_profile_id: input.profileId,
    });
    if (error) throw new Error(toUserFacingError(error, "Could not verify whether this mobile is available."));
    phoneTaken = Boolean(data);
  }

  if (emailRaw.length > 0) {
    const { data, error } = await service.rpc("profile_email_taken_by_other", {
      p_email: emailRaw,
      p_exclude_profile_id: input.profileId,
    });
    if (error) throw new Error(toUserFacingError(error, "Could not verify whether this email is available."));
    emailTaken = Boolean(data);
  }

  return { phoneTaken, emailTaken };
}

/** Human-readable conflict message for profile edit forms. */
export function formatContactConflictError(conflict: ContactConflict): string | null {
  if (conflict.phoneTaken && conflict.emailTaken) {
    return "That mobile number and email are already linked to another account.";
  }
  if (conflict.phoneTaken) {
    return "That mobile number is already linked to another account.";
  }
  if (conflict.emailTaken) {
    return "That email is already linked to another account.";
  }
  return null;
}

/** Compare stored vs submitted phone for duplicate-check skipping on vitals-only edits. */
export function profilePhoneUnchanged(
  existingPhone: string | null | undefined,
  nextPhoneE164: string | null,
): boolean {
  if (!nextPhoneE164) return !existingPhone?.trim();
  const existingNorm = existingPhone?.trim() ? normalizeToE164(existingPhone.trim()) : null;
  if (existingNorm?.ok) return existingNorm.e164 === nextPhoneE164;
  return phoneDigitsForComparison(existingPhone ?? "") === phoneDigitsForComparison(nextPhoneE164);
}

export function profileEmailUnchanged(
  existingEmail: string | null | undefined,
  nextEmail: string | null,
): boolean {
  const a = existingEmail?.trim().toLowerCase() ?? "";
  const b = nextEmail?.trim().toLowerCase() ?? "";
  return a === b;
}

export type SameOrganizationMembershipNotice = {
  organizationName: string;
  branchName: string;
  status: string;
  isActive: boolean;
  outletId: string;
};

/**
 * Memberships at the staff member's gym org(s) — used in the link dialog only.
 * Cross-org history is intentionally hidden (OneX Club floating customer model).
 */
export function sameOrganizationMembershipNotices(
  gymHistory: CustomerGymHistoryEntry[],
  staffOrganizationIds: string[],
): SameOrganizationMembershipNotice[] {
  if (!staffOrganizationIds.length) return [];
  const orgSet = new Set(staffOrganizationIds);

  return gymHistory
    .filter((entry) => entry.organization_id && orgSet.has(entry.organization_id))
    .map((entry) => ({
      organizationName: entry.organization_name?.trim() || "Your gym",
      branchName: entry.gym_name?.trim() || entry.branch?.trim() || "Branch",
      status: entry.status,
      isActive: entry.is_active,
      outletId: entry.outlet_id,
    }));
}

export type SameBranchMembershipNotice = SameOrganizationMembershipNotice;

/** Membership at a specific branch the staff manages — strongest onboard conflict hint. */
export function sameBranchMembershipNotices(
  gymHistory: CustomerGymHistoryEntry[],
  staffOutletIds: string[],
): SameBranchMembershipNotice[] {
  if (!staffOutletIds.length) return [];
  const outletSet = new Set(staffOutletIds);
  return gymHistory
    .filter((entry) => outletSet.has(entry.outlet_id))
    .map((entry) => ({
      organizationName: entry.organization_name?.trim() || "Your gym",
      branchName: entry.gym_name?.trim() || entry.branch?.trim() || "Branch",
      status: entry.status,
      isActive: entry.is_active,
      outletId: entry.outlet_id,
    }));
}

/** Lookup a single branch row when staff already picked an outlet in the wizard. */
export function membershipNoticeForOutlet(
  gymHistory: CustomerGymHistoryEntry[],
  outletId: string,
): SameBranchMembershipNotice | null {
  if (!outletId) return null;
  return sameBranchMembershipNotices(gymHistory, [outletId])[0] ?? null;
}
