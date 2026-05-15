-- =============================================================================
-- Case-insensitive profile email lookup for superadmin onboarding.
-- -----------------------------------------------------------------------------
-- Reason: Postgres UNIQUE on `profiles.email` is case-sensitive (`User@x` ≠ `user@x`),
-- but Auth treats addresses case-insensitively. Actions call this via service_role
-- `.rpc(...)` — see `guardAdminEmailNotAlreadyRegistered` in app/superadmin/onboard/actions.ts.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.profile_email_exists_normalized(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE lower(trim(p.email)) = lower(trim(p_email))
      AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.profile_email_exists_normalized(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_email_exists_normalized(text) TO service_role;

COMMENT ON FUNCTION public.profile_email_exists_normalized(text) IS
  'True when a non-deleted profile row exists for this email with case and outer whitespace ignored. Shared by onboarding; moderate together with onboarding actions.';

-- PostgREST (Supabase API) keeps a schema cache; new RPCs are invisible until reload.
NOTIFY pgrst, 'reload schema';
