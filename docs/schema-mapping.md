# Schema ↔ admin console mapping

This repository assumes the **multi-tenant “organization → outlet → membership”** model (not a single `gym_id` column on `profiles`).

| UI / route concept | Supabase representation | Notes |
| --- | --- | --- |
| **Superadmin** | `profiles.is_superadmin = true` | Must be flipped with the **service role** or direct SQL — never from the client. Resolves to `UserRole = 'superadmin'` in app code (`src/types/roles.ts`). |
| **Gym owner** | `staff_assignments.role = 'gym_owner'` | Org-wide outlet management via `i_manage_outlet()` (all branches sharing `organization_id`). Organization **UPDATE** is **gym_owner-only** in RLS. |
| **Branch admin** | `staff_assignments.role = 'branch_admin'` | Manages assigned outlet(s) only (no org-wide outlet creation implied by SQL helper). Can see staff profiles within the org for management. |
| **Receptionist** | `staff_assignments.role = 'receptionist'` | Front desk: `/staff` console, assigned `outlet_id` rows. |
| **Trainer** | `staff_assignments.role = 'trainer'` | Same route prefix as receptionist today; split permissions later if needed. |
| **Member / customer** | `gym_memberships` rows with `role = 'customer'` | Profiles are "floating"; tenancy is expressed through memberships. Resolves to `UserRole = 'customer'` when there is no staff assignment. |
| **Gym / tenant** | `organizations` + child `outlets` | Superadmin "onboard gym" creates both, then attaches a **`gym_owner`** on the first outlet (`src/app/superadmin/onboard/actions.ts`). |

## Reuse points (moderation guide)

- **Role constants + resolution**: `src/types/roles.ts` — `ROLES`, `UserRole`, `resolveUserRoleFromStaff`, `ADMIN_CONSOLE_ROLES`, `STAFF_CONSOLE_ROLES`.
- **Auth + managed outlets**: `src/services/auth.service.ts` (`getAuthDashboardContext`) — includes **`managedOutletIds`** (gym owners get every branch in their org(s)).
- **Browser Supabase**: `src/hooks/useSupabaseBrowser.ts` — import in client components instead of re-instantiating clients.
- **Dashboard chrome**: `src/components/layout/DashboardShell.tsx` + `SidebarNav.tsx` — add new sections by extending the `navItems` array in each role `layout.tsx`.
- **Privileged provisioning**: `src/lib/supabase/admin.ts` — **server-only** helper for `auth.admin.createUser` flows after manual authorization checks.

If you already run the full **Gym SaaS v1.0** migration from your platform docs, treat this file as documentation only and skip duplicate DDL in `supabase/migrations/`.
