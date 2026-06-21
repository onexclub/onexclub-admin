import GymOwnerWelcomeEmail from "@/emails/gym-owner-welcome";
import CustomerWelcomeEmail from "@/emails/customer-welcome";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { ROUTES } from "@/utils/routes";
import { Resend } from "resend";
import type { TransactionalEmailPurpose } from "@/lib/email/transactional-email-purpose";
import { getAppOriginForEmail } from "@/lib/email/app-origin-for-email";
import { ONEX_WEBSITE_URL } from "@/emails/onex-email-brand";
import {
  formatResendFromAddress,
  isResendFromConfigured,
} from "@/lib/email/resend-from-address";
import { renderReactEmail } from "@/lib/email/render-react-email";

/**
 * transactional welcome mail for superadmin onboarding.
 *
 * Wired from: {@link ../../app/superadmin/onboard/actions.ts#onboardGymAction}.
 * Future routes (REST `onboard-gym`) should call these same helpers — do not duplicate Resend payloads.
 */

let resendSingleton: Resend | null | undefined;

function getResend(): Resend | null {
  if (resendSingleton !== undefined) {
    return resendSingleton;
  }
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn("[email] RESEND_API_KEY is unset — transactional emails will be skipped.");
    resendSingleton = null;
    return resendSingleton;
  }
  resendSingleton = new Resend(key);
  return resendSingleton;
}

/**
 * Optional audit trail. Applies migration `021_email_logs.sql`; if missing, inserts fail silently — mail still sends.
 */
async function appendEmailAuditLog(row: {
  email_type: TransactionalEmailPurpose;
  outlet_id?: string | null;
  org_id?: string | null;
  profile_id?: string | null;
  related_id?: string | null;
  resend_id?: string | null;
  status: "sent";
  subject: string;
  to_email: string;
  to_name: string | null;
}): Promise<void> {
  try {
    const admin = createServiceRoleSupabaseClient();
    const { error } = await admin.from("email_logs").insert({
      ...row,
      sent_at: new Date().toISOString(),
    });
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      console.info("[email] email_logs table not found — skipping audit row (optional migration `021`).");
      return;
    }
    if (error) {
      console.warn("[email] Failed to append email_logs:", error.message);
    }
  } catch (e) {
    console.warn("[email] Failed to append email_logs:", e);
  }
}

export async function sendGymOwnerWelcome({
  gymName,
  orgId,
  outletCity,
  outletName,
  ownerEmail,
  ownerName,
  planTier,
}: {
  gymName: string;
  /** For optional `email_logs` row */
  orgId: string;
  outletCity: string;
  outletName: string;
  ownerEmail: string;
  ownerName: string;
  planTier: string;
}): Promise<
  | { error: unknown; skipped?: false; success: false }
  | { reason: string; skipped: true; success: false }
  | { success: true }
> {
  const resend = getResend();
  const from = formatResendFromAddress("GymOS Platform");
  if (!resend || !from) {
    return { skipped: true, reason: "resend_not_configured", success: false };
  }

  const subject = `Welcome to GymOS, ${gymName}! Your dashboard is ready 🎉`;
  let html: string;
  try {
    html = await renderReactEmail(
      GymOwnerWelcomeEmail({
        gymName,
        loginUrl: `${getAppOriginForEmail()}${ROUTES.login}`,
        outletCity,
        outletName,
        ownerName,
        planTier,
        supportEmail: process.env.SUPPORT_EMAIL ?? "support@gymplatform.com",
      }),
    );
  } catch (err) {
    console.error("[email] Gym owner welcome template render failed:", err);
    return { error: err, success: false };
  }

  const { data, error } = await resend.emails.send({
    from,
    html,
    subject,
    to: `${ownerName || ownerEmail} <${ownerEmail}>`,
  });

  if (error) {
    console.error("[email] Gym owner welcome failed:", error);
    return { error, success: false };
  }

  await appendEmailAuditLog({
    email_type: "gym_owner_welcome",
    org_id: orgId,
    outlet_id: null,
    profile_id: null,
    related_id: null,
    resend_id: data?.id ?? null,
    status: "sent",
    subject,
    to_email: ownerEmail,
    to_name: ownerName || null,
  });

  return { success: true };
}

/** Date format shared with customer-facing copy */
const membershipDateFmt: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

type OutletOrgRow = {
  city: string | null;
  email: string | null;
  name: string | null;
  organizations: { id: string; name: string } | null;
  phone: string | null;
};

type MembershipBundle = {
  assigned_trainer_id: string | null;
  id: string;
  outlets: OutletOrgRow | null;
  plan_name: string | null;
  membership_plans?: { name: string } | null;
  outlet_id: string;
  plan_id: string | null;
  end_date: string | null;
  start_date: string;
};

async function customerWelcomeAlreadyLogged(profileId: string): Promise<boolean> {
  try {
    const admin = createServiceRoleSupabaseClient();
    const { data, error } = await admin
      .from("email_logs")
      .select("id")
      .eq("profile_id", profileId)
      .eq("email_type", "customer_welcome")
      .limit(1)
      .maybeSingle();
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return false;
      }
      console.warn("[email] customer_welcome dedupe check:", error.message);
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}

export type SendCustomerWelcomeOptions = {
  /**
   * Default `true`. Gym staff onboarding passes `false` so welcome goes to the profile email
   * immediately — members sign in with phone OTP and may not verify email first.
   */
  requireEmailConfirmed?: boolean;
  /** Staff QA retry — bypass `email_logs` dedupe so Resend is invoked again. */
  skipDedupe?: boolean;
};

/** Maps {@link sendCustomerWelcome} result to staff-visible copy (QA button, onboarding logs). */
export function describeCustomerWelcomeSendResult(
  result: Awaited<ReturnType<typeof sendCustomerWelcome>>,
): { success?: string; error?: string; debug?: string } {
  if (result.success) {
    if ("alreadySent" in result && result.alreadySent) {
      return {
        success: "Skipped — customer welcome was already logged in email_logs.",
        debug: "alreadySent",
      };
    }
    return {
      success: "Welcome email accepted by Resend.",
      debug: "resendId" in result && result.resendId ? result.resendId : "sent",
    };
  }

  if ("reason" in result) {
    const reasonMessages: Record<string, string> = {
      resend_not_configured:
        "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in the server environment.",
      auth_user_not_found: "No Auth user for this profile — member may not be fully provisioned.",
      email_not_verified: "Auth email is not verified yet (welcome requires confirmation for this path).",
      profile_not_found: "Profile record not found.",
      no_email: "No email on profile or Auth user.",
      no_active_membership: "No active gym membership — welcome email needs an active membership with outlet/org.",
    };
    return {
      error: reasonMessages[result.reason] ?? `Could not send welcome email (${result.reason}).`,
      debug: result.reason,
    };
  }

  if ("error" in result && result.error != null) {
    const raw =
      typeof result.error === "object" && result.error !== null && "message" in result.error
        ? String((result.error as { message: unknown }).message)
        : typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error);
    return {
      error: `Resend rejected the send: ${raw}`,
      debug: raw,
    };
  }

  return { error: "Welcome email failed for an unknown reason.", debug: "unknown" };
}

/** Called from `POST /api/send-customer-welcome` (internal key) — e.g. Supabase webhook / Edge Function. */
export async function sendCustomerWelcome(
  profileId: string,
  options?: SendCustomerWelcomeOptions,
): Promise<
  | { alreadySent?: false; error: unknown; success: false }
  | { alreadySent: true; success: true }
  | { reason: string; success: false }
  | { resendId?: string | null; success: true }
> {
  const resend = getResend();
  if (!resend || !isResendFromConfigured()) {
    return { reason: "resend_not_configured", success: false };
  }

  const admin = createServiceRoleSupabaseClient();

  if (!options?.skipDedupe && (await customerWelcomeAlreadyLogged(profileId))) {
    return { alreadySent: true, success: true };
  }

  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(profileId);
  if (authErr || !authData.user) {
    return { reason: "auth_user_not_found", success: false };
  }
  const requireEmailConfirmed = options?.requireEmailConfirmed !== false;
  if (requireEmailConfirmed && !authData.user.email_confirmed_at) {
    console.log(`[email] Profile ${profileId}: email not confirmed in Auth — skip customer welcome`);
    return { reason: "email_not_verified", success: false };
  }

  const authEmail = authData.user.email?.trim() ?? "";

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", profileId)
    .maybeSingle();

  if (profileErr || !profile) {
    return { reason: "profile_not_found", success: false };
  }

  const toEmail = (profile.email?.trim() || authEmail) || "";
  if (!toEmail) {
    console.log(`[email] Profile ${profileId}: no email — skip customer welcome`);
    return { reason: "no_email", success: false };
  }

  const { data: membership, error: memErr } = await admin
    .from("gym_memberships")
    .select(
      `
      id,
      plan_name,
      plan_id,
      start_date,
      end_date,
      outlet_id,
      assigned_trainer_id,
      outlets (
        name,
        city,
        phone,
        email,
        organizations (
          id,
          name
        )
      ),
      membership_plans ( name )
    `,
    )
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memErr) {
    console.error("[email] Membership load:", memErr);
    return { error: memErr, success: false };
  }

  const mem = membership as MembershipBundle | null;
  const outlet = mem?.outlets ?? null;
  const org = outlet?.organizations ?? null;

  if (!mem || !outlet || !org) {
    console.log(`[email] Profile ${profileId}: no active membership — skip customer welcome`);
    return { reason: "no_active_membership", success: false };
  }
  let trainerName: string | null = null;
  if (mem.assigned_trainer_id) {
    const { data: trainer } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", mem.assigned_trainer_id)
      .maybeSingle();
    trainerName = trainer?.full_name ?? null;
  }

  const planLabel =
    mem.membership_plans?.name?.trim() || mem.plan_name?.trim() || "Membership";

  const subject = `Welcome to ${org.name}! Your membership is active 💪`;

  const recipientLabel = profile.full_name?.trim()
    ? `${profile.full_name.trim()} <${toEmail}>`
    : toEmail;

  const from = formatResendFromAddress(org.name);
  if (!from) {
    return { reason: "resend_not_configured", success: false };
  }

  let html: string;
  try {
    html = await renderReactEmail(
      CustomerWelcomeEmail({
        brandLogoUrl: `${getAppOriginForEmail()}/brand/logo-wordmark.png`,
        websiteUrl: process.env.ONEXCLUB_WEBSITE_URL?.trim() || ONEX_WEBSITE_URL,
        endDate:
          mem.end_date != null
            ? new Date(mem.end_date).toLocaleDateString("en-IN", membershipDateFmt)
            : null,
        gymName: org.name,
        gymPhone: outlet.phone ?? null,
        memberName: profile.full_name?.trim() || "there",
        memberPhone: profile.phone ?? null,
        outletCity: outlet.city ?? "",
        outletName: outlet.name ?? "",
        planName: planLabel,
        startDate: new Date(mem.start_date).toLocaleDateString("en-IN", membershipDateFmt),
        trainerName,
      }),
    );
  } catch (err) {
    console.error("[email] Customer welcome template render failed:", err);
    return { error: err, success: false };
  }

  const { data, error } = await resend.emails.send({
    from,
    html,
    subject,
    to: recipientLabel,
  });

  if (error) {
    console.error("[email] Customer welcome failed:", error);
    return { error, success: false };
  }

  await appendEmailAuditLog({
    email_type: "customer_welcome",
    outlet_id: mem.outlet_id,
    org_id: org.id,
    profile_id: profileId,
    related_id: mem.id,
    resend_id: data?.id ?? null,
    status: "sent",
    subject,
    to_email: toEmail,
    to_name: profile.full_name ?? null,
  });

  return { success: true, resendId: data?.id ?? null };
}

/**
 * Gym staff onboarding — send welcome as soon as membership is created.
 * Wired from {@link ../../app/admin/members/onboard/actions.ts}.
 */
export async function sendCustomerWelcomeAfterGymOnboard(
  profileId: string,
): Promise<
  | { alreadySent?: false; error: unknown; success: false }
  | { alreadySent: true; success: true }
  | { reason: string; success: false }
  | { success: true }
> {
  return sendCustomerWelcome(profileId, { requireEmailConfirmed: false });
}
