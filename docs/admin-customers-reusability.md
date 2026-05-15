# Admin customers page: reusability notes

This note documents what was intentionally reused while adding the Admin customers list (`/admin/customers`) so future updates stay consistent.

## Reused patterns

- `getAuthDashboardContext` from `src/services/auth.service.ts`
  - Reused to derive the current user role and managed outlets.
  - Keeps role checks/outlet selection logic centralized.

- `createServerSupabaseClient` from `src/lib/supabase/server.ts`
  - Reused for server-side RLS-safe reads of `gym_memberships`.
  - Avoids introducing new data-access wrappers unnecessarily.

- Outlet scoping approach from existing admin pages
  - Same `managedOutletIds` / `gym_owner` + `branch_admin` scope as:
    - `src/app/admin/page.tsx`
    - `src/app/admin/members/onboard/page.tsx`
  - Ensures Admin sees only customers linked to managed outlets.

- Existing UI primitives
  - `EmptyState` reused for no-outlet, no-data, and load-error states.
  - Existing dashboard styling patterns reused to keep UI consistent.

## Why this matters

- Reduces duplicate authorization logic in multiple pages.
- Keeps behavior predictable across Admin flows.
- Makes future moderation/refactors easier by reusing known, reviewed paths.
