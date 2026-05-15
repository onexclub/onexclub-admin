# Gym dashboard RBAC (`/dashboard/**`)

Single source of truth: `src/lib/auth/roles.ts`

- `UserRole`, `ROLES`, `PERMISSIONS`, `hasAccess()`, `canWrite()`, `ASSIGNABLE_ROLES`
- `dashboardRouteMatchers` + `dashboardFeatureForPath()` — keep aligned with middleware (longest `/dashboard/*` prefix wins).
- `dashboardSidebarItems()` — nav labels + “View Only” badges **without hardcoding role names** in sidebar components.

## Adding a gated page

1. Add or reuse a `DashboardFeature` entry in `PERMISSIONS` (`read` / `write` role arrays).
2. Add `{ prefix: "/dashboard/your-path", feature }` to `dashboardRouteMatchers` **above** the catch-all `/dashboard` row.
3. Push a nav row from `dashboardSidebarItems()` when the route should appear in the shell.
4. Wrap destructive UI with `components/auth/RoleGuard.tsx` (`requireWrite` when only owners should mutate).
5. Mirror the same rules in Server Actions (`src/app/dashboard/**/actions.ts` and shared modules like `src/app/admin/customers/actions.ts`).

## Legacy `/admin` redirects

`src/lib/supabase/middleware.ts` rewrites `/admin/*` to `/dashboard/*` after refreshing the Supabase session so old links keep working.

## Database + RLS

Enum `user_role` and policies live under `supabase/migrations/`. Diet/exercise plans + roster tightening: `008_dashboard_diet_exercise_staff_rls.sql`; front-desk profile updates: `009_profiles_branch_staff_update.sql`.

If the app errors with **`column gym_memberships.assigned_trainer_id does not exist`**, your DB never applied the `ALTER` from `008` (often because the rest of that migration failed and rolled back). Run the idempotent patch **`010_patch_gym_memberships_assigned_trainer.sql`** from the Supabase SQL Editor, then refresh — see `supabase/README.md`.

If **`/dashboard/staff`** shows **Unable to read roster** with **`invalid input value for enum user_role: "gym_admin"`**, legacy rows still use label `gym_admin` while this repo’s enum expects **`gym_owner`**. Run **`011_legacy_user_role_gym_admin_normalize.sql`** (SQL Editor or `supabase db push`), then re-apply **`006_gym_owner_rls_i_manage_outlet_hotfix.sql`** if your `i_manage_outlet` body is outdated.

## Related modules worth reusing

- `components/layout/Sidebar.tsx` — maps permission fragments onto `SidebarNav` items (`buildSidebarNavItemsFromPermissions`).
- `components/layout/SidebarNav.tsx` — renders optional `badge` (used for “View Only”).
- `services/auth.service.ts` — `getAuthDashboardContext()` for server guards and outlet scope.
