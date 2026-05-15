/**
 * Public Supabase env (URL + anon key) — shared by browser and server SSR clients.
 *
 * Reuse: keep validation and onboarding hints in this one module so `client.ts`
 * and `server.ts` stay thin; update here if variable names or setup steps change.
 */
export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      [
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        "Copy .env.example to .env.local at the project root, set both values from Supabase → Project Settings → API, then restart `next dev` so Next.js reloads env.",
      ].join(" "),
    );
  }
  return { url, anonKey };
}
