-- =============================================================================
-- One-off: set the QA member password on existing customer Auth accounts.
--
-- Password: oneXclub@007  (must match src/lib/auth/customer-provisioning.ts)
--
-- Run in Supabase Dashboard → SQL Editor (service role / postgres).
-- NOT a migration — do not commit to automated deploy pipelines for production.
--
-- Targets: auth.users linked to at least one active gym_memberships row, excluding
-- superadmins and active staff roster rows.
--
-- Flutter sign-in: phone (E.164) or email + password "oneXclub@007"
-- =============================================================================

BEGIN;

-- Preview who will be updated (safe to run alone first — comment out BEGIN/COMMIT if preview-only)
SELECT
  u.id,
  u.email,
  u.phone,
  p.full_name,
  (u.encrypted_password IS NOT NULL) AS had_password_before
FROM auth.users u
JOIN public.profiles p ON p.id = u.id AND p.deleted_at IS NULL
WHERE p.is_superadmin IS NOT TRUE
  AND u.deleted_at IS NULL
  AND u.id IN (
    SELECT DISTINCT gm.profile_id
    FROM public.gym_memberships gm
    WHERE gm.deleted_at IS NULL
  )
  AND u.id NOT IN (
    SELECT sa.profile_id
    FROM public.staff_assignments sa
    WHERE sa.revoked_at IS NULL
  )
ORDER BY p.full_name NULLS LAST, u.phone, u.email;

-- Apply fixed debug password (bcrypt via pgcrypto — same as Supabase Auth expects)
UPDATE auth.users u
SET
  encrypted_password = crypt('oneXclub@007', gen_salt('bf')),
  phone_confirmed_at = COALESCE(u.phone_confirmed_at, NOW()),
  updated_at = NOW()
WHERE u.deleted_at IS NULL
  AND u.id IN (
    SELECT DISTINCT gm.profile_id
    FROM public.gym_memberships gm
    WHERE gm.deleted_at IS NULL
  )
  AND u.id NOT IN (
    SELECT sa.profile_id
    FROM public.staff_assignments sa
    WHERE sa.revoked_at IS NULL
  )
  AND u.id IN (
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND p.is_superadmin IS NOT TRUE
  );

-- Row count from the UPDATE above (Postgres reports this in the SQL editor result)
SELECT COUNT(*) AS customers_with_membership
FROM auth.users u
WHERE u.deleted_at IS NULL
  AND u.id IN (
    SELECT DISTINCT gm.profile_id
    FROM public.gym_memberships gm
    WHERE gm.deleted_at IS NULL
  )
  AND u.id NOT IN (
    SELECT sa.profile_id
    FROM public.staff_assignments sa
    WHERE sa.revoked_at IS NULL
  )
  AND u.id IN (
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL AND p.is_superadmin IS NOT TRUE
  );

COMMIT;
