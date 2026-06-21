/**
 * Normalizes `RESEND_FROM_EMAIL` for Resend API calls.
 *
 * Env may be a bare address (`hello@email.onexclub.in`) or already formatted
 * (`One X Club <hello@email.onexclub.in>`). Callers must use {@link formatResendFromAddress}
 * so we never produce invalid nested `from` values like `GymOS <One X Club <hello@…>>`.
 *
 * **Reuse:** `send-welcome-emails.ts`, `send-member-email-verification-link.ts`, and any new Resend sender.
 */

export type ParsedResendFrom = {
  email: string;
  /** Display name from env when env was `Name <email>` */
  displayName?: string;
};

/** Parses bare email or single `Display Name <email@domain.com>` pair. */
export function parseResendFromEnv(raw: string): ParsedResendFrom {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.+?)\s*<([^<>]+)>$/);
  if (match) {
    return { displayName: match[1].trim(), email: match[2].trim() };
  }
  return { email: trimmed };
}

export function getResendFromEnvRaw(): string | null {
  const raw = process.env.RESEND_FROM_EMAIL?.trim();
  return raw || null;
}

/** Bare mailbox from env — strips any display-name wrapper. */
export function getResendFromEmailAddress(): string | null {
  const raw = getResendFromEnvRaw();
  if (!raw) return null;
  const { email } = parseResendFromEnv(raw);
  return email.includes("@") ? email : null;
}

export function isResendFromConfigured(): boolean {
  return getResendFromEmailAddress() != null;
}

/**
 * Resend-safe `Name <email@domain.com>`.
 * @param displayName Sender label for this message (gym org name, "GymOS Platform", etc.).
 */
export function formatResendFromAddress(displayName: string): string | null {
  const raw = getResendFromEnvRaw();
  if (!raw) return null;

  const parsed = parseResendFromEnv(raw);
  if (!parsed.email.includes("@")) return null;

  const name = displayName.trim() || parsed.displayName?.trim() || "GymOS";
  return `${name} <${parsed.email}>`;
}
