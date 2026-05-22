# Schema ↔ admin console mapping

This repository assumes the **multi-tenant “organization → outlet → membership”** model (not a single `gym_id` column on `profiles`).

| UI / route concept | Supabase representation | Notes |
| --- | --- | --- |
| **Superadmin** | `profiles.is_superadmin = true` | Must be flipped with the **service role** or direct SQL — never from the client. Resolves to `UserRole = 'superadmin'` in app code (`src/types/roles.ts`). |
| **Gym owner** | `staff_assignments.role = 'gym_owner'` | Org-wide outlet management via `i_manage_outlet()` (all branches sharing `organization_id`). Organization **UPDATE** is **gym_owner-only** in RLS. |
| **Branch admin** | `staff_assignments.role = 'branch_admin'` | Manages assigned outlet(s) only (no org-wide outlet creation implied by SQL helper). Can see staff profiles within the org for management. |
| **Receptionist** | `staff_assignments.role = 'receptionist'` | Front desk: `/staff` console, assigned `outlet_id` rows. |
| **Trainer** | `staff_assignments.role = 'trainer'` | Same route prefix as receptionist today; split permissions later if needed. |
| **Member / customer** | `gym_memberships` rows with `role = 'customer'` | Profiles are "floating"; tenancy is expressed through memberships. Resolves to `UserRole = 'customer'` when there is no staff assignment. **Auth:** phone-primary (OTP); optional email — see `docs/auth-by-role.md` and migration `020_*` for nullable `profiles.email`. |
| **Gym / tenant** | `organizations` + child `outlets` | Superadmin "onboard gym" creates both, then attaches a **`gym_owner`** on the first outlet (`src/app/superadmin/onboard/actions.ts`). |

## Reuse points (moderation guide)

- **Role constants + resolution**: `src/types/roles.ts` — `ROLES`, `UserRole`, `resolveUserRoleFromStaff`, `ADMIN_CONSOLE_ROLES`, `STAFF_CONSOLE_ROLES`.
- **Auth + managed outlets**: `src/services/auth.service.ts` (`getAuthDashboardContext`) — includes **`managedOutletIds`** (gym owners get every branch in their org(s)).
- **Browser Supabase**: `src/hooks/useSupabaseBrowser.ts` — import in client components instead of re-instantiating clients.
- **Dashboard chrome**: `src/components/layout/DashboardShell.tsx` + `SidebarNav.tsx` — add new sections by extending the `navItems` array in each role `layout.tsx`.
- **Privileged provisioning**: `src/lib/supabase/admin.ts` — **server-only** helper for `auth.admin.createUser` flows after manual authorization checks.
- **Sign-in matrix + form copy**: `src/lib/auth/role-sign-in-policy.ts` + `src/lib/auth/phone-e164.ts` — keep in sync with `docs/auth-by-role.md`.
- **Member vitals (DOB, gender, height, weight, BMI)**: `src/lib/profile/vitals.ts` + `ProfileVitalsFields` / `ProfileVitalsSummary` — persisted on `profiles`; BMI is generated in Postgres.
- **Floating customer lookup (onboard only)**: `024_customer_lookup.sql` + `src/lib/customers/customer-lookup.ts` + `customer-onboard-prefill.ts` + `ExistingCustomerLinkDialog` — Identity step calls `lookupExistingCustomerAction`; link confirm loads `loadExistingCustomerPrefillAction` (profile + portable questionnaire). Submit passes `existing_profile_id` to `onboardMemberWizardAction`. Profile **edit** uses `contactTakenByOtherProfile` in `updateCustomerProfileAction` (errors only, no modal).
- **Onboard draft (localStorage)**: `customer-onboard-draft.ts` + `CustomerOnboardDraftPanel` + `CustomerCustomersViewTabs` — explicit “Save as draft”; `/dashboard/customers?tab=drafts` to resume (`/customers/new?resume=1`); “New customer” always fresh.
- **Audit (`created_by` / `updated_by` / `audit_log`)**: `022_audit_tracking.sql` + `023_profiles_created_by.sql` + `src/lib/supabase/audit-columns.ts`. **Customer onboard:** `gym_memberships.created_by` = who created the membership (Overview “Onboarded by”); `profiles.created_by` = who first provisioned the Auth/profile row (`auditActorOnFirstProfileProvision` after `createUser`); `profiles.updated_by` = last profile editor. Legacy `gym_memberships.onboarded_by` still written for old list filters. Apply both migrations in Supabase before expecting columns in the dashboard.

If you already run the full **Gym SaaS v1.0** migration from your platform docs, treat this file as documentation only and skip duplicate DDL in `supabase/migrations/`.
