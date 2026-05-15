import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROUTES } from "@/utils/routes";

/**
 * POST /auth/signout — clears Supabase cookies via SSR client helpers.
 * Route handler keeps logout logic off the client bundle.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(ROUTES.login, request.url));
}
