"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-origin";
import { ROUTES } from "@/utils/routes";

export type ForgotPasswordState = {
  error?: string;
  /** Generic success copy to reduce email enumeration. */
  message?: string;
};

/**
 * Sends Supabase’s recovery email. Requires project email (or SMTP) and redirect URL
 * allowlisting in the Supabase dashboard — see README.
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
  }

  const origin = await getSiteOrigin();
  const callbackUrl = new URL(ROUTES.authCallback, origin);
  callbackUrl.searchParams.set("next", ROUTES.authUpdatePassword);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl.toString(),
  });

  if (error) {
    return { error: error.message };
  }

  return {
    message:
      "If an account exists for that email, you will receive a reset link shortly. Check spam and confirm Supabase email settings if nothing arrives.",
  };
}
