-- Duplicate contact guards for profile edit (migration 024 subset — was missing on remote).
-- **Reuse:** `contactTakenByOtherProfile` in `src/lib/customers/customer-lookup.ts`

CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH stripped AS (
    SELECT NULLIF(
      CASE
        WHEN d IS NOT NULL AND length(d) = 11 AND d LIKE '0%' THEN substring(d from 2)
        ELSE d
      END,
      ''
    ) AS digits
    FROM (
      SELECT NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '') AS d
    ) s
  )
  SELECT CASE
    WHEN digits IS NULL THEN NULL
    WHEN length(digits) = 10 THEN '91' || digits
    ELSE digits
  END
  FROM stripped;
$$;

CREATE OR REPLACE FUNCTION public.profile_email_taken_by_other(
  p_email text,
  p_exclude_profile_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE lower(trim(COALESCE(p.email, ''))) = lower(trim(p_email))
      AND p.deleted_at IS NULL
      AND (p_exclude_profile_id IS NULL OR p.id <> p_exclude_profile_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_phone_taken_by_other(
  p_phone text,
  p_exclude_profile_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE normalize_phone_digits(p.phone) = normalize_phone_digits(p_phone)
      AND normalize_phone_digits(p_phone) IS NOT NULL
      AND p.deleted_at IS NULL
      AND (p_exclude_profile_id IS NULL OR p.id <> p_exclude_profile_id)
  );
$$;

REVOKE ALL ON FUNCTION public.profile_email_taken_by_other(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_phone_taken_by_other(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_email_taken_by_other(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.profile_phone_taken_by_other(text, uuid) TO service_role;
