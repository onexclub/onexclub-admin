import { headers } from "next/headers";

/**
 * Absolute site origin for auth redirect URLs (password reset, magic links, etc.).
 *
 * Reuse: any server code that must build a callback URL for Supabase Auth should call
 * this instead of duplicating host/proto logic — keeps staging vs prod consistent.
 */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    return "http://localhost:3000";
  }
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
