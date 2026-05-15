-- =============================================================================
-- Hotfix: `gym_owner` — see ALL branches in the same org
-- =============================================================================
-- Run in Supabase **SQL Editor** if gym owners only see one outlet, missing
-- address/city on other branches, or org logo loads fail because organization
-- rows cannot be joined reliably.
--
-- Root cause (common): `i_manage_outlet` still checks a **legacy** owner label
-- (e.g. `gym_admin`) after your enum was renamed to `gym_owner`, so the
-- org-wide EXISTS branch never matches.
--
-- This version only checks `gym_owner` (see `001_*` + `011_*`). If you still
-- have DB rows with label `gym_admin`, run `011_legacy_user_role_gym_admin_normalize.sql`
-- so data matches the enum defined in this repo.
--
-- Also ignores soft-deleted outlets in the org-wide EXISTS clause.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.i_manage_outlet(p_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p_outlet_id = ANY (ARRAY(SELECT my_staff_outlet_ids()))
        OR EXISTS (
            SELECT 1
            FROM staff_assignments sa
            JOIN outlets my_o ON my_o.id = sa.outlet_id
            JOIN outlets target ON target.id = p_outlet_id
            WHERE sa.profile_id = auth.uid()
              AND sa.revoked_at IS NULL
              AND sa.role = 'gym_owner'
              AND my_o.deleted_at IS NULL
              AND target.deleted_at IS NULL
              AND my_o.organization_id = target.organization_id
        );
$$;

-- Legacy `gym_admin` rows: use migration `011_legacy_user_role_gym_admin_normalize.sql`.
