-- =============================================================================
-- Dashboard expansion:
-- - `gym_memberships.assigned_trainer_id`
-- - `staff_assignments.invite_pending`
-- - `diet_plans` + `exercise_plans`
-- - RLS tightening for roster mutations + authoring tables
--
-- Depends on earlier bootstrap (`001_gym_saas_core_admin_console.sql`).
-- =============================================================================

ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS assigned_trainer_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_memberships_assigned_trainer
    ON gym_memberships(assigned_trainer_id)
    WHERE deleted_at IS NULL AND assigned_trainer_id IS NOT NULL;

ALTER TABLE staff_assignments
    ADD COLUMN IF NOT EXISTS invite_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN staff_assignments.invite_pending IS
    'True immediately after an owner invites via server action; clears when the staff member accepts.';

-- ────────────────────────────────────────────────────────────────
CREATE TABLE diet_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_template BOOLEAN NOT NULL DEFAULT false,
    title TEXT NOT NULL,
    plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    trainer_notes TEXT,
    attachments_json JSONB,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_profile UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT diet_plan_shape CHECK (
        (is_template = true AND profile_id IS NULL)
        OR (is_template = false AND profile_id IS NOT NULL)
    ),
    UNIQUE (profile_id, title, outlet_id)
);

CREATE TABLE exercise_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_template BOOLEAN NOT NULL DEFAULT false,
    title TEXT NOT NULL,
    plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    trainer_notes TEXT,
    attachments_json JSONB,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_profile UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT exercise_plan_shape CHECK (
        (is_template = true AND profile_id IS NULL)
        OR (is_template = false AND profile_id IS NOT NULL)
    ),
    UNIQUE (profile_id, title, outlet_id)
);

CREATE INDEX idx_diet_plan_outlet ON diet_plans(outlet_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_diet_plan_profile ON diet_plans(profile_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_ex_plan_outlet ON exercise_plans(outlet_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ex_plan_profile ON exercise_plans(profile_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS touch_diet_plans ON diet_plans;
CREATE TRIGGER touch_diet_plans
    BEFORE UPDATE ON diet_plans
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_exercise_plans ON exercise_plans;
CREATE TRIGGER touch_exercise_plans
    BEFORE UPDATE ON exercise_plans
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMENT ON COLUMN diet_plans.attachments_json IS 'Array/map of HTTPS URLs referencing Supabase Storage uploads (validated in app tier).';

-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION i_am_org_gym_owner_for_outlet(p_outlet UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
          FROM outlets target
          JOIN staff_assignments sa
            ON sa.profile_id = auth.uid()
           AND sa.revoked_at IS NULL
           AND sa.role = 'gym_owner'
          JOIN outlets mine
            ON mine.id = sa.outlet_id
           AND mine.organization_id = target.organization_id
        WHERE target.id = p_outlet
    );
$$;

CREATE OR REPLACE FUNCTION i_plan_owner_or_branch_admin_row(p_outlet UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_assignments sa
        WHERE sa.profile_id = auth.uid()
          AND sa.outlet_id = p_outlet
          AND sa.revoked_at IS NULL
          AND sa.role IN ('gym_owner','branch_admin')
    )
    OR i_am_org_gym_owner_for_outlet(p_outlet);
$$;

CREATE OR REPLACE FUNCTION i_trainer_at_outlet(p_outlet UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_assignments sa
        WHERE sa.profile_id = auth.uid()
          AND sa.outlet_id = p_outlet
          AND sa.revoked_at IS NULL
          AND sa.role = 'trainer'
    );
$$;

CREATE OR REPLACE FUNCTION i_member_assigned_trainer_here(p_profile UUID, p_outlet UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM gym_memberships gm
        WHERE gm.profile_id = p_profile
          AND gm.outlet_id = p_outlet
          AND gm.assigned_trainer_id = auth.uid()
          AND gm.deleted_at IS NULL
    );
$$;

ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_diet_all" ON diet_plans FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "diet_owner_branch_admin_full" ON diet_plans FOR ALL TO authenticated
    USING (is_superadmin() OR i_plan_owner_or_branch_admin_row(outlet_id))
    WITH CHECK (is_superadmin() OR i_plan_owner_or_branch_admin_row(outlet_id));

CREATE POLICY "diet_trainer_scoped_rw" ON diet_plans FOR ALL TO authenticated
    USING (
        i_trainer_at_outlet(outlet_id)
        AND (
            is_template IS TRUE
            OR i_member_assigned_trainer_here(profile_id, outlet_id)
        )
        AND deleted_at IS NULL
    )
    WITH CHECK (
        i_trainer_at_outlet(outlet_id)
        AND (
            is_template IS TRUE
            OR i_member_assigned_trainer_here(profile_id, outlet_id)
        )
    );

CREATE POLICY "customer_diet_read_own" ON diet_plans FOR SELECT TO authenticated
    USING (
        profile_id = auth.uid()
        AND deleted_at IS NULL
        AND is_template IS FALSE
    );

CREATE POLICY "superadmin_exercise_all" ON exercise_plans FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "exercise_owner_branch_admin_full" ON exercise_plans FOR ALL TO authenticated
    USING (is_superadmin() OR i_plan_owner_or_branch_admin_row(outlet_id))
    WITH CHECK (is_superadmin() OR i_plan_owner_or_branch_admin_row(outlet_id));

CREATE POLICY "exercise_trainer_scoped_rw" ON exercise_plans FOR ALL TO authenticated
    USING (
        i_trainer_at_outlet(outlet_id)
        AND (
            is_template IS TRUE
            OR i_member_assigned_trainer_here(profile_id, outlet_id)
        )
        AND deleted_at IS NULL
    )
    WITH CHECK (
        i_trainer_at_outlet(outlet_id)
        AND (
            is_template IS TRUE
            OR i_member_assigned_trainer_here(profile_id, outlet_id)
        )
    );

CREATE POLICY "customer_exercise_read_own" ON exercise_plans FOR SELECT TO authenticated
    USING (
        profile_id = auth.uid()
        AND deleted_at IS NULL
        AND is_template IS FALSE
    );

-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "branch_mgmt_staff_assignments_all" ON staff_assignments;

DROP POLICY IF EXISTS "staff_assignments_roster_owner_rw" ON staff_assignments;

CREATE POLICY "staff_assignments_read_scope" ON staff_assignments FOR SELECT TO authenticated
    USING (
        is_superadmin()
        OR profile_id = auth.uid()
        OR i_manage_outlet(outlet_id)
    );

CREATE POLICY "staff_assignments_owner_insert" ON staff_assignments FOR INSERT TO authenticated
    WITH CHECK (
        is_superadmin()
        OR i_am_org_gym_owner_for_outlet(outlet_id)
    );

CREATE POLICY "staff_assignments_owner_update" ON staff_assignments FOR UPDATE TO authenticated
    USING (is_superadmin() OR i_am_org_gym_owner_for_outlet(outlet_id))
    WITH CHECK (is_superadmin() OR i_am_org_gym_owner_for_outlet(outlet_id));

CREATE POLICY "staff_assignments_owner_delete" ON staff_assignments FOR DELETE TO authenticated
    USING (is_superadmin() OR i_am_org_gym_owner_for_outlet(outlet_id));
