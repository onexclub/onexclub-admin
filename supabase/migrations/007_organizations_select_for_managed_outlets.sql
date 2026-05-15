-- =============================================================================
-- Organizations SELECT for anyone who can i_manage_outlet() in that org
-- =============================================================================
-- Symptom in the app: branches/outlets load on /admin/organization but "HQ / brand
-- details" is empty — PostgREST embed + direct SELECT on `organizations` both
-- evaluate RLS on this table.
--
-- `staff_orgs_read` (001) only grants org visibility via:
--   staff_assignments → outlets.organization_id
-- That covers most staff, but gym owners (org-wide `i_manage_outlet`) and any
-- edge case where outlet rows are visible under branch-mgmt policies should also
-- be able to read the parent `organizations` row for branding / address_json.
--
-- Safe pattern: OR in an EXISTS that reuses existing SECURITY DEFINER helper
-- `i_manage_outlet` (already used for outlet mutations in 001 / 006).
-- =============================================================================

DROP POLICY IF EXISTS "staff_orgs_read" ON public.organizations;

CREATE POLICY "staff_orgs_read" ON public.organizations
    FOR SELECT TO authenticated
    USING (
        -- Original: any org tied to an outlet where I have a staff row
        id IN (
            SELECT o.organization_id
            FROM public.staff_assignments sa
            JOIN public.outlets o ON o.id = sa.outlet_id
            WHERE sa.profile_id = auth.uid()
              AND sa.revoked_at IS NULL
        )
        OR EXISTS (
            SELECT 1
            FROM public.outlets target
            WHERE target.organization_id = organizations.id
              AND target.deleted_at IS NULL
              AND public.i_manage_outlet(target.id)
        )
    );
