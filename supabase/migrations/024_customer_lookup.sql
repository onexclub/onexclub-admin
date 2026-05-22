-- =============================================================================
-- Floating customer lookup — phone/email match + gym history for onboarding.
-- -----------------------------------------------------------------------------
-- **Reuse:** `src/lib/customers/customer-lookup.ts` calls these RPCs via service_role
-- from server actions (`lookupExistingCustomerAction`, profile edit duplicate guards).
-- Moderate together with `003_profile_email_normalized_match.sql`.
-- =============================================================================

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

COMMENT ON FUNCTION public.normalize_phone_digits(text) IS
  'Canonical digit form for phone equality — 10-digit locals get 91 prefix (matches phone-e164.ts).';

-- Case-insensitive email check with optional profile exclusion (profile edit flows).
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

-- Onboarding: find floating customer + prior gym memberships (any org/outlet).
CREATE OR REPLACE FUNCTION public.find_existing_customer(
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_phone_digits text;
  v_email_norm text;
  v_profile jsonb;
  v_history jsonb;
BEGIN
  v_phone_digits := normalize_phone_digits(p_phone);
  v_email_norm := NULLIF(lower(trim(COALESCE(p_email, ''))), '');

  IF v_phone_digits IS NULL AND v_email_norm IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM profiles p
  WHERE p.deleted_at IS NULL
    AND (
      (v_phone_digits IS NOT NULL AND normalize_phone_digits(p.phone) = v_phone_digits)
      OR (v_email_norm IS NOT NULL AND lower(trim(COALESCE(p.email, ''))) = v_email_norm)
    )
  ORDER BY
    CASE
      WHEN v_phone_digits IS NOT NULL AND normalize_phone_digits(p.phone) = v_phone_digits THEN 0
      ELSE 1
    END,
    p.created_at ASC
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'profile_id', p.id,
    'full_name', p.full_name,
    'phone', p.phone,
    'email', p.email,
    'bmi', p.bmi,
    'gender', p.gender,
    'date_of_birth', p.date_of_birth,
    'height_cm', p.height_cm,
    'weight_kg', p.weight_kg,
    'member_since', p.created_at
  )
  INTO v_profile
  FROM profiles p
  WHERE p.id = v_profile_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', gm.id,
        'outlet_id', gm.outlet_id,
        'gym_name', o.name,
        'branch', o.name,
        'city', o.city,
        'organization_id', org.id,
        'organization_name', org.name,
        'plan', COALESCE(mp.name, gm.plan_name),
        'status', gm.status::text,
        'start_date', gm.start_date,
        'end_date', gm.end_date,
        'is_active', (gm.status = 'active' AND gm.deleted_at IS NULL)
      )
      ORDER BY gm.joined_at DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  INTO v_history
  FROM gym_memberships gm
  JOIN outlets o ON o.id = gm.outlet_id AND o.deleted_at IS NULL
  LEFT JOIN organizations org ON org.id = o.organization_id AND org.deleted_at IS NULL
  LEFT JOIN membership_plans mp ON mp.id = gm.plan_id
  WHERE gm.profile_id = v_profile_id
    AND gm.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'found', true,
    'profile_id', v_profile_id,
    'full_name', v_profile->>'full_name',
    'phone', v_profile->>'phone',
    'email', v_profile->>'email',
    'bmi', v_profile->'bmi',
    'gender', v_profile->>'gender',
    'date_of_birth', v_profile->>'date_of_birth',
    'height_cm', v_profile->'height_cm',
    'weight_kg', v_profile->'weight_kg',
    'member_since', v_profile->>'member_since',
    'gym_history', v_history
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_existing_customer(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_existing_customer(text, text) TO service_role;

COMMENT ON FUNCTION public.find_existing_customer(text, text) IS
  'Onboarding lookup: match profile by normalized phone (preferred) or email; returns gym_history JSON array.';

NOTIFY pgrst, 'reload schema';
