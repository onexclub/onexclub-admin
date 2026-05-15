# OnexClub Admin — Gym SaaS console

Next.js **App Router** admin panel for a multi-tenant gym platform backed by **Supabase Auth + RLS**.

## Prerequisites

- Node.js 20+
- A Supabase project

## Installation

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in values from **Project Settings → API** in Supabase.

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, used by the browser and server helpers.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**. Used for `auth.admin.createUser` after explicit authorization checks in Server Actions. Never expose this to the client.
- `NEXT_PUBLIC_SITE_URL` (recommended for production) — canonical origin for password-reset links when the app cannot infer host from headers. Example: `https://admin.example.com`.

### Password reset (forgot password)

The app exposes **`/forgot-password`** → email link → **`/auth/callback`** → **`/auth/update-password`**. In Supabase: **Authentication → URL configuration**, add these to **Redirect URLs** (adjust host as needed):

- `http://localhost:3000/auth/callback`
- Your deployed origin, for example `https://your-domain.com/auth/callback`

Ensure **email** is configured (Supabase built-in or custom SMTP) under **Project Settings → Authentication** so reset messages are delivered.

If you are not using email yet, you can still set a password: create the user in the Supabase dashboard with a known password, or run a **one-off trusted script** locally using the service role (never ship this in the app):

```ts
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
await admin.auth.admin.updateUserById("<auth_user_uuid>", { password: "<new_password>" });
```

## Database setup

1. Run `supabase/migrations/001_gym_saas_core_admin_console.sql` in the Supabase SQL editor **or** apply your full **Gym SaaS v1.0** migration if that is your canonical schema (avoid running both if they conflict).
2. Create your first Auth user in Supabase Authentication.
3. Promote that user to platform superadmin:

```sql
update profiles
set is_superadmin = true
where id = '<auth_user_uuid>';
```

4. Sign in at `/login` with that user to access `/superadmin`.

## Local development

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Role routes

| Route | Who |
| --- | --- |
| `/superadmin` | `profiles.is_superadmin = true` |
| `/admin` | `staff_assignments.role IN ('gym_owner', 'branch_admin')` |
| `/staff` | `staff_assignments.role IN ('receptionist', 'trainer')` |
| `/unauthorized` | Everyone else (for example customers) |

## Where to extend

- **Role model**: `src/types/roles.ts` (`ROLES`, `UserRole`, console helpers)
- **Auth context**: `src/services/auth.service.ts`
- **Middleware refresh + RBAC**: `src/lib/supabase/middleware.ts`
- **Password reset**: `src/app/forgot-password/`, `src/app/auth/callback/route.ts`, `src/components/auth/UpdatePasswordForm.tsx` (shared origin helper: `src/lib/site-origin.ts`)
- **Privileged server actions**: `src/app/**/actions.ts` + `src/lib/supabase/admin.ts`
- **Schema mapping notes**: `docs/schema-mapping.md`

## Scripts

```bash
npm run lint
npm run build
```
