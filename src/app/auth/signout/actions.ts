"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROUTES } from "@/utils/routes";

/**
 * Clears the Supabase session cookies, then redirects to login.
 *
 * **Reuse:** `SignOutButton` — prefer this Server Action over raw POST to `/auth/signout`
 * so cookie writes go through `cookies()` on the action response (see auth/callback route
 * for the Route Handler variant when a non-React client must POST sign-out).
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
