import { ROUTES } from "@/utils/routes";

/**
 * Prevents open redirects: only same-origin relative paths we expect after Auth
 * callbacks are allowed. Extend the allowlist if you add more post-auth landing routes.
 */
export function safeAuthNextPath(raw: string | null): string {
  const fallback = ROUTES.authUpdatePassword;
  if (!raw) {
    return fallback;
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return fallback;
  }
  if (t !== ROUTES.authUpdatePassword) {
    return fallback;
  }
  return t;
}
