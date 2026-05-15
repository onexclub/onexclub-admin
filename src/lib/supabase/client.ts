import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/**
 * Browser Supabase client — safe to use in Client Components.
 * Uses the public anon key only (RLS applies).
 */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
