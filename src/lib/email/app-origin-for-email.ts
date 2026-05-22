/**
 * Stable absolute origin for plain links inside emails (cron / server actions / route handlers —
 * reuse instead of importing `headers()`-based {@link ../site-origin#getSiteOrigin}, which requires
 * a Request context during static analysis in some setups).
 *
 * Mirrors `NEXT_PUBLIC_SITE_URL` from `site-origin.ts`.
 */
export function getAppOriginForEmail(): string {
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const fromApp = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return fromSite || fromApp || "http://localhost:3000";
}
