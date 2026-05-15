/**
 * Section-level onboarding RBAC helpers.
 *
 * **Mapping:** product copy may mention `org_owner` — codebase uses {@link ROLES.GYM_OWNER}.
 *
 * **Reuse:** mirror these guards inside Server Actions beside RLS (`012_onboarding_questionnaire.sql`).
 */
import { ROLES, type UserRole } from "@/lib/auth/roles";

import { ONBOARDING_FORM } from "./constants";
import type { OnboardingFormName } from "./types";

export function canViewOnboardingSection(role: UserRole, formName: OnboardingFormName): boolean {
  if (role === ROLES.CUSTOMER) return true;
  if (
    role === ROLES.SUPERADMIN ||
    role === ROLES.GYM_OWNER ||
    role === ROLES.BRANCH_ADMIN ||
    role === ROLES.RECEPTIONIST ||
    role === ROLES.TRAINER
  ) {
    return (
      formName === ONBOARDING_FORM.basic ||
      formName === ONBOARDING_FORM.health ||
      formName === ONBOARDING_FORM.diet
    );
  }
  return false;
}

export function canEditOnboardingSection(role: UserRole, formName: OnboardingFormName): boolean {
  if (role === ROLES.CUSTOMER) return true; // enforced per-field via `editable_by_customer`
  if (role === ROLES.SUPERADMIN || role === ROLES.GYM_OWNER || role === ROLES.BRANCH_ADMIN) return true;
  if (role === ROLES.RECEPTIONIST) return formName === ONBOARDING_FORM.basic;
  if (role === ROLES.TRAINER) return formName === ONBOARDING_FORM.health || formName === ONBOARDING_FORM.diet;
  return false;
}

export function isSectionReadOnlyForRole(role: UserRole, formName: OnboardingFormName): boolean {
  return canViewOnboardingSection(role, formName) && !canEditOnboardingSection(role, formName);
}
