/**
 * **Product matrix:** how each role is meant to sign in and what contact fields staff must collect.
 *
 * **Reuse (moderators):**
 * - Import {@link ROLE_AUTH_MATRIX_ROW_ORDER}, {@link staffProvisioningPhoneHint}, {@link customerMemberContactCopy}
 *   from UI (client-safe) and Server Actions (`phone-e164.ts` for validation).
 * - Keep `docs/auth-by-role.md` aligned — it is the human-readable mirror of this module.
 *
 * **Code roles:** `ROLES` in `@/lib/auth/roles.ts` (`gym_owner` = org owner in product language).
 */

import { ROLES, type AssignableStaffRole, type UserRole } from "@/lib/auth/roles";

export type RoleAuthMatrixRow = {
  role: UserRole;
  /** Product-facing name (table / tooltips). */
  label: string;
  /** Primary channel after the account exists. */
  primarySignIn: string;
  /** Secondary / recovery channel (use `—` when none). */
  supplementalSignIn: string;
  /** What to capture on `profiles` / Auth for support / OTP. */
  profileContactRule: string;
};

/** Stable table order for docs and any future settings UI. */
export const ROLE_AUTH_MATRIX_ROW_ORDER: readonly RoleAuthMatrixRow[] = [
  {
    role: ROLES.SUPERADMIN,
    label: "Superadmin",
    primarySignIn: "Email + password",
    supplementalSignIn: "—",
    profileContactRule: "No Phone OTP — **email mandatory**.",
  },
  {
    role: ROLES.GYM_OWNER,
    label: "Gym owner (org owner)",
    primarySignIn: "Email + password",
    supplementalSignIn: "—",
    profileContactRule: "No Phone OTP — **email mandatory**.",
  },
  {
    role: ROLES.BRANCH_ADMIN,
    label: "Branch admin",
    primarySignIn: "Email + password",
    supplementalSignIn: "—",
    profileContactRule: "No Phone OTP — **email mandatory**.",
  },
  {
    role: ROLES.RECEPTIONIST,
    label: "Receptionist",
    primarySignIn: "Email + password",
    supplementalSignIn: "Phone OTP",
    profileContactRule: "**Phone mandatory** (OTP) alongside work email.",
  },
  {
    role: ROLES.TRAINER,
    label: "Trainer",
    primarySignIn: "Email + password",
    supplementalSignIn: "Phone OTP",
    profileContactRule: "**Phone mandatory** (OTP) alongside work email.",
  },
  {
    role: ROLES.CUSTOMER,
    label: "Member / customer",
    primarySignIn: "Phone OTP (primary)",
    supplementalSignIn: "Email (optional)",
    profileContactRule: "**Phone mandatory**; email optional.",
  },
];

export function staffProvisioningPhoneHint(role: AssignableStaffRole): string {
  if (role === ROLES.BRANCH_ADMIN) {
    return "Optional for this role — sign-in is email + password only (no Phone OTP).";
  }
  if (role === ROLES.RECEPTIONIST) {
    return "Required — Phone OTP is enabled for front desk; store the number they will verify on their device.";
  }
  if (role === ROLES.TRAINER) {
    return "Required — coaches use Phone OTP in addition to email + password.";
  }
  return "";
}

/** `true` when `/dashboard/staff/new` must block submit without a valid phone (server enforces the same). */
export function isStaffPhoneRequiredForProvisioning(role: AssignableStaffRole): boolean {
  return role === ROLES.RECEPTIONIST || role === ROLES.TRAINER;
}

/** Short strings for customer contact field labels in onboard / profile forms. */
export function customerMemberContactCopy(): { phoneLabel: string; emailLabel: string } {
  return {
    phoneLabel: "Mobile (primary login)",
    emailLabel: "Email (optional)",
  };
}
