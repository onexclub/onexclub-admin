/**
 * Shared HTTP helpers for Edge Functions under `supabase/functions/`.
 * Reuse from any function via: `import { jsonResponse } from "../_shared/http.ts"`
 */

export const JSON_HEADERS = {
  "Content-Type": "application/json",
} as const;

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
