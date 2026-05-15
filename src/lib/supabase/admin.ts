import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE ROLE CLIENT — SERVER ONLY
 *
 * **Not for branding / org reads in normal UI.** Gym admins read `organizations.logo_url`,
 * `address_json`, etc. through {@link createServerSupabaseClient} (RLS, user JWT).
 * Shared loader: `src/lib/admin/gym-organization-dashboard.ts`.
 *
 * Bypasses Row Level Security. Never import this file from Client Components,
 * shared modules used by the browser bundle, or any code path that could leak
 * `SUPABASE_SERVICE_ROLE_KEY` to the client.
 *
 * Use only inside Server Actions / Route Handlers after you have verified the
 * caller's identity with `createServerSupabaseClient()` + your own authorization checks.
 */
export function createServiceRoleSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      [
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        "Add both to .env.local (see .env.example). Never prefix the service role with NEXT_PUBLIC_. Restart `next dev` after changes.",
      ].join(" "),
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
