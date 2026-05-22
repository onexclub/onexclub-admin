/**
 * MSG91 OTP helpers — shared by `send-otp` and `verify-otp`.
 * Docs: https://docs.msg91.com/otp
 *
 * Secrets (set in Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
 * - MSG91_AUTH_KEY — required for both functions
 * - MSG91_FLOW_ID — template / flow id for send-otp only
 */

const MSG91_BASE = "https://control.msg91.com/api/v5/otp";

/** E.164 (+91…) → MSG91 mobile digits without leading `+`. */
export function toMsg91Mobile(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getMsg91AuthKey(): string {
  const key = Deno.env.get("MSG91_AUTH_KEY");
  if (!key) {
    throw new Error("MSG91_AUTH_KEY is not configured");
  }
  return key;
}

export function getMsg91FlowId(): string | undefined {
  return Deno.env.get("MSG91_FLOW_ID") ?? undefined;
}

/** POST — send OTP via MSG91 (custom 6-digit code in body). */
export async function msg91SendOtp(mobile: string, otp: number) {
  const flowId = getMsg91FlowId();
  const response = await fetch(MSG91_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: getMsg91AuthKey(),
    },
    body: JSON.stringify({
      mobile,
      otp,
      ...(flowId ? { template_id: flowId } : {}),
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

/**
 * GET — verify OTP with MSG91.
 * @see https://docs.msg91.com/otp/verify-otp
 */
export async function msg91VerifyOtp(mobile: string, otp: string) {
  const params = new URLSearchParams({ mobile, otp });
  const response = await fetch(`${MSG91_BASE}/verify?${params}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authkey: getMsg91AuthKey(),
    },
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}
