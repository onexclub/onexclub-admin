# Middleware notes

- **Entry file**: `src/middleware.ts` (Next.js convention — must not be nested as `middleware/index.ts`).
- **Session refresh + RBAC**: implemented in `src/lib/supabase/middleware.ts` (`updateSession`) so the logic stays testable and reusable. `/admin` allows `GYM_ADMIN_SHELL_ROLES` (owners/admins + receptionists/trainers); `/staff` stays `STAFF_CONSOLE_ROLES` only; `/superadmin` is `superadmin`. Keep in sync with `src/types/roles.ts` and Supabase `user_role`.
- **Matcher tuning**: Next.js 16 + Turbopack requires `export const config.matcher` to be **statically analyzable**. Do not import matcher arrays from other modules; update the inline `matcher` in `src/middleware.ts` when you add route prefixes that need auth refresh.
