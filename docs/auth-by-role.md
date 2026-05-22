# Authentication channels by role

This is the **product / support matrix** for how each role is expected to sign in after their account exists. Implementation lives in Supabase Auth (email + password, SMS / Phone OTP, etc.) and the mobile app for members.

**Single source for dashboard UI copy:** `src/lib/auth/role-sign-in-policy.ts` — import `ROLE_AUTH_MATRIX_ROW_ORDER`, `staffProvisioningPhoneHint`, `customerMemberContactCopy`, and `isStaffPhoneRequiredForProvisioning`. Phone normalization for forms lives in `src/lib/auth/phone-e164.ts`.

**Code roles:** enum `user_role` and `ROLES` in `src/lib/auth/roles.ts`. **`gym_owner`** is the stored value; it is the same concept as **org owner** in product language.

| Role (product) | DB `user_role` | Primary sign-in | Supplemental | Phone / email on profile |
| --- | --- | --- | --- | --- |
| Superadmin | `superadmin` | Email + password | — | No Phone OTP — **email mandatory** |
| Gym owner | `gym_owner` | Email + password | — | No Phone OTP — **email mandatory** |
| Branch admin | `branch_admin` | Email + password | — | No Phone OTP — **email mandatory** |
| Receptionist | `receptionist` | Email + password | Phone OTP | **Phone mandatory** (OTP) |
| Trainer | `trainer` | Email + password | Phone OTP | **Phone mandatory** (OTP) |
| Customer / member | `customer` | **Phone OTP** (primary) | Email (optional) | **Phone mandatory**; email optional |

## Staff provisioning (`/dashboard/staff/new`)

`CreateStaffMemberForm` provisions **email + temporary password** for assignable roles (`branch_admin`, `receptionist`, `trainer`). **Receptionist** and **trainer** require a **normalized mobile** on both `profiles.phone` and `auth.users` (Phone OTP). **Branch admin** keeps phone optional (email-only sign-in policy).

Superadmin and gym owner accounts are created through other flows (platform console / gym onboard); this table still describes their **intended** sign-in experience.

**Moderation:** Changing someone’s role to receptionist or trainer in **Role & branch** requires a phone already saved on the profile; otherwise the server action returns a clear error.

## Member onboarding / CRM

When staff capture member details, **phone is mandatory** — the primary login path is **Phone OTP** in the member app. **Email is optional** but, when provided, is attached in Supabase Auth during provisioning.

**DB note:** Run migration `020_profiles_nullable_email_phone_signup.sql` so `profiles.email` can be null for phone-only members and `handle_new_user` copies `auth.users.phone` into `profiles.phone`.

UI surfaces this policy in:

- `AddCustomerOnboardWizard` (add-customer flow)
- `CustomerMembershipOnboardingSummaryTab` (membership detail “Onboarding” tab)

## Related docs

- `docs/dashboard-rbac.md` — route and feature permissions.
- `docs/schema-mapping.md` — how roles map to `profiles` / `staff_assignments` / `gym_memberships`.
