/**
 * Temporary customer Auth credentials while the member Flutter app signs in with phone/email + password for QA.
 *
 * **Reuse:** import {@link CUSTOMER_DEBUG_TEMP_PASSWORD} in member onboard
 * (`src/app/admin/members/onboard/actions.ts`) when calling `auth.admin.createUser` or
 * `auth.admin.updateUserById`. Staff temporary passwords stay in `/dashboard/staff/new`.
 *
 * **Remove before production:** drop fixed passwords; use Phone OTP (primary) or generated one-time passwords.
 */

/** Fixed member password for local / staging Flutter login during development. */
export const CUSTOMER_DEBUG_TEMP_PASSWORD = "oneXclub@007";
