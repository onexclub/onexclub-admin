import { Resend } from "resend";
import { getAppOriginForEmail } from "@/lib/email/app-origin-for-email";
import { ROUTES } from "@/utils/routes";

/**
 * After `auth.admin.createUser` with `email_confirm: false`, Supabase does **not** email the user
 * (see GoTrueAdminApi `createUser` docs). We call `auth.admin.generateLink({ type: "magiclink", ... })`
 * and deliver `properties.action_link` ourselves via Resend so members can verify email while using
 * phone OTP to sign in.
 *
 * Reuse: same pattern when a member adds/changes email in profile (email_change links) — prefer
 * `generateLink` types `email_change_*` for address swaps.
 */

let resendSingleton: Resend | null | undefined;

function getResend(): Resend | null {
  if (resendSingleton !== undefined) return resendSingleton;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    resendSingleton = null;
    return resendSingleton;
  }
  resendSingleton = new Resend(key);
  return resendSingleton;
}

export async function sendMemberEmailVerificationLink(params: {
  memberName: string;
  toEmail: string;
  /** From `generateLink` → `data.properties.action_link` (absolute Supabase verify URL). */
  actionLink: string;
}): Promise<{ error?: string; skipped?: boolean }> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!resend || !from) {
    console.warn("[email] Cannot send verification link — RESEND_* missing.");
    return { skipped: true };
  }

  const { actionLink, memberName, toEmail } = params;
  const friendly = memberName.trim() || "there";

  const { error } = await resend.emails.send({
    from: `GymOS <${from}>`,
    subject: "Confirm your email",
    text: [
      `Hi ${friendly},`,
      "",
      "Confirm this email address for your membership account (you can keep signing in with your phone number).",
      "",
      actionLink,
      "",
      `If you did not expect this, ignore this message.`,
    ].join("\n"),
    to: toEmail,
  });

  if (error) {
    console.error("[email] Verification link email failed:", error);
    return { error: typeof error === "object" && error && "message" in error ? String(error.message) : "send failed" };
  }

  return {};
}

/**
 * Builds redirect target for magic link verification; must be allowed in Supabase Auth URL config.
 */
export function authCallbackRedirectUrlForEmailVerification(): string {
  return `${getAppOriginForEmail()}${ROUTES.authCallback}`;
}
