/**
 * Audit column helpers for `created_by` / `updated_by` (migration `022_audit_tracking.sql`).
 *
 * **How it works**
 * - User-scoped Supabase client (`createServerSupabaseClient`): Postgres triggers set NULL
 *   columns from `auth.uid()` via `auto_set_audit_cols()` / `auto_set_updated_by_col()`.
 * - Service-role client (`createServiceRoleSupabaseClient`): `auth.uid()` is NULL — spread
 *   these helpers on inserts/updates so staff actions still record the real actor.
 *
 * **Reuse:** any server action that mutates tenant rows with the service role after
 * `getAuthDashboardContext()` authorization.
 */

/** Spread on INSERT when using service role (sets both creator and last editor). */
export function auditActorOnInsert(actorProfileId: string | null | undefined): {
  created_by?: string;
  updated_by?: string;
} {
  if (!actorProfileId) return {};
  return { created_by: actorProfileId, updated_by: actorProfileId };
}

/** Spread on UPDATE when using service role (does not touch created_by — trigger preserves it). */
export function auditActorOnUpdate(actorProfileId: string | null | undefined): {
  updated_by?: string;
} {
  if (!actorProfileId) return {};
  return { updated_by: actorProfileId };
}

/**
 * First staff write to `profiles` after `auth.admin.createUser` (member/staff onboard).
 * Sets both `created_by` (provisioner) and `updated_by`. Use once per new Auth user — not on later edits.
 */
export const auditActorOnFirstProfileProvision = auditActorOnInsert;
