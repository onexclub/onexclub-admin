import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeAuthNextPath } from "@/lib/auth/safe-next-path";
import { sendCustomerWelcome } from "@/lib/email/send-welcome-emails";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";
import { ROUTES } from "@/utils/routes";

/**
 * OAuth / email recovery callback. Supabase redirects here with either:
 * - `code` (PKCE): exchange for a session, or
 * - `token_hash` + `type` (e.g. recovery): verify OTP to establish session.
 *
 * Reuse: add OAuth providers later without duplicating cookie wiring — keep session
 * exchange in this single route and point Supabase “redirect to” URLs here.
 *
 * After a successful session (PKCE or OTP), we attempt {@link sendCustomerWelcome} so members who
 * just confirmed their email receive the Resend welcome immediately. Duplicates are suppressed via
 * `email_logs` when migration `021_email_logs.sql` is applied.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const nextPath = safeAuthNextPath(searchParams.get("next"));
  const redirectTarget = new URL(nextPath, origin);
  const errorRedirect = new URL(ROUTES.authCodeError, origin);

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const response = NextResponse.redirect(redirectTarget);

  let url: string;
  let anonKey: string;
  try {
    ({ url, anonKey } = getPublicSupabaseEnv());
  } catch {
    return NextResponse.redirect(errorRedirect);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(errorRedirect);
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      void sendCustomerWelcome(user.id).catch((err) =>
        console.error("[email] customer welcome after auth callback:", err),
      );
    }
    return response;
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash,
    });
    if (error) {
      return NextResponse.redirect(errorRedirect);
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      void sendCustomerWelcome(user.id).catch((err) =>
        console.error("[email] customer welcome after OTP verify:", err),
      );
    }
    return response;
  }

  return NextResponse.redirect(errorRedirect);
}
