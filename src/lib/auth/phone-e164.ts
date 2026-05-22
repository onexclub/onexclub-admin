/**
 * Normalizes free-form phone input for **Supabase Auth phone providers** (expects E.164).
 *
 * **India default:** 10-digit local mobiles are stored/compared as `+91XXXXXXXXXX`.
 * UI with a fixed `+91` prefix should call {@link formatPhoneLocalDigits} / {@link sanitizeIndianLocalPhoneInput}.
 *
 * **Reuse:** `createStaffMemberAction`, `onboardMemberWizardAction`, `customer-lookup.ts`, and OTP flows.
 * Moderators: if you change validation rules, update copy in `docs/auth-by-role.md` and re-test wizards.
 */

export type PhoneNormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; message: string };

/** Default country when staff enter a 10-digit local mobile (OneX Club is India-first). */
export const DEFAULT_PHONE_COUNTRY_CODE = "91";

/** Strip to digits and drop a single leading `0` from local dial (e.g. `09876543210`). */
export function phoneDigitsOnly(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Canonical digit form for DB comparison — mirrors `normalize_phone_digits()` in migration `024_*`.
 * 10-digit locals become `91` + local so lookup matches `+919876543210`.
 */
export function phoneDigitsForComparison(input: string): string {
  const digits = phoneDigitsOnly(input);
  if (!digits.length) return "";

  if (digits.length === 10) {
    return `${DEFAULT_PHONE_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

/**
 * For inputs with a fixed `+91` prefix — show only the 10-digit local part.
 * Accepts E.164 (`+919876543210`) or legacy rows missing country code.
 */
export function formatPhoneLocalDigits(stored: string | null | undefined): string {
  if (!stored?.trim()) return "";
  const digits = phoneDigitsOnly(stored);
  if (digits.startsWith(DEFAULT_PHONE_COUNTRY_CODE) && digits.length === 12) {
    return digits.slice(DEFAULT_PHONE_COUNTRY_CODE.length);
  }
  if (digits.length === 10) {
    return digits;
  }
  return digits;
}

/** Restrict keyed input to up to 10 local digits (India mobile field with `+91` prefix). */
export function sanitizeIndianLocalPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

/**
 * Converts staff input to E.164 for Auth + Supabase.
 * - `9876543210` → `+919876543210`
 * - `919876543210` / `+91 98765 43210` → `+919876543210`
 */
export function normalizeToE164(input: string): PhoneNormalizeResult {
  const raw = input.trim();
  if (!raw) return { ok: false, message: "Phone is required." };

  const digits = phoneDigitsOnly(raw);

  if (digits.length === 10) {
    return { ok: true, e164: `+${DEFAULT_PHONE_COUNTRY_CODE}${digits}` };
  }

  if (digits.length === 12 && digits.startsWith(DEFAULT_PHONE_COUNTRY_CODE)) {
    return { ok: true, e164: `+${digits}` };
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return { ok: true, e164: `+${digits}` };
  }

  if (digits.length < 10) {
    return { ok: false, message: "Enter a valid 10-digit mobile number." };
  }

  return { ok: false, message: "Enter a valid mobile number." };
}
