/**
 * Maps Supabase / PostgREST / Auth raw errors to staff-friendly copy.
 *
 * **Reuse:** server actions before returning `{ error: ... }` to forms.
 * Keeps technical schema-cache / SQL noise out of the UI.
 */
export function toUserFacingError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error == null) return fallback;

  if (typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return mapRawMessage((error as { message: string }).message, fallback);
  }

  if (error instanceof Error) {
    return mapRawMessage(error.message, fallback);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return mapRawMessage(error, fallback);
  }

  return fallback;
}

function mapRawMessage(raw: string, fallback: string): string {
  const msg = raw.trim();
  if (!msg.length) return fallback;

  const lower = msg.toLowerCase();

  if (lower.includes("schema cache") || lower.includes("could not find the function public.")) {
    return "We couldn't verify contact details right now. Please try again in a moment.";
  }

  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    if (lower.includes("phone")) return "That mobile number is already linked to another account.";
    if (lower.includes("email")) return "That email is already linked to another account.";
    return "Those details are already in use on another account.";
  }

  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Sign-in failed. Check your mobile or email and try again.";
  }

  if (lower.includes("jwt expired") || lower.includes("session")) {
    return "Your session expired. Please sign in again.";
  }

  if (lower.includes("permission denied") || lower.includes("forbidden") || lower.includes("not authorized")) {
    return "You don't have permission to do that.";
  }

  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("timeout")) {
    return "Connection problem — check your network and try again.";
  }

  /** Pass through short, already-human messages from our own validators. */
  if (
    msg.length <= 160 &&
    !msg.includes("PGRST") &&
    !msg.includes("SQLSTATE") &&
    !msg.includes("pg_") &&
    !lower.startsWith("could not find")
  ) {
    return msg;
  }

  return fallback;
}
