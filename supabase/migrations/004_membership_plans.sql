-- =============================================================================
-- Gym SaaS — membership_plans (+ plan linkage on gym_memberships)
--
-- Mirrors “patch v1.2”: outlet-scoped plans, FK from memberships, helpers for
-- cross-branch rules when v1.1-style override columns are present.
--
-- Apply after `001_gym_saas_core_admin_console.sql`. Safe against fresh installs;
-- skips columns that already exist (e.g. if you pasted the stand-alone patches).
-- =============================================================================

-- ── Override columns referenced by get_effective_plan_settings (v1.1-style) ──
ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS allow_cross_branch BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS cross_branch_visits_allowed INT;

ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS cross_branch_quota_period TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS cross_branch_org_only BOOLEAN NOT NULL DEFAULT true;

-- ────────────────────────────────────────────────────────────────
CREATE TABLE membership_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,
    color_hex TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,

    price NUMERIC(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',

    duration_days INT,

    allow_cross_branch BOOLEAN NOT NULL DEFAULT false,
    cross_branch_visits_allowed INT,
    cross_branch_quota_period TEXT NOT NULL DEFAULT 'monthly',
    cross_branch_org_only BOOLEAN NOT NULL DEFAULT true,

    features_json JSONB,

    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE (outlet_id, name)
);

CREATE INDEX idx_plans_outlet ON membership_plans(outlet_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plans_active ON membership_plans(outlet_id, is_active) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS touch_membership_plans ON membership_plans;
CREATE TRIGGER touch_membership_plans
    BEFORE UPDATE ON membership_plans
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES membership_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mem_plan ON gym_memberships(plan_id);

-- Count cross-branch visits: check-ins at outlets other than the membership’s home outlet.
CREATE OR REPLACE FUNCTION get_cross_branch_usage(
    p_membership_id UUID,
    p_period TEXT
)
RETURNS INT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_profile UUID;
    v_home UUID;
    v_since TIMESTAMPTZ;
BEGIN
    SELECT gm.profile_id, gm.outlet_id
      INTO v_profile, v_home
      FROM gym_memberships gm
     WHERE gm.id = p_membership_id
       AND gm.deleted_at IS NULL;

    IF NOT FOUND OR v_home IS NULL THEN
        RETURN 0;
    END IF;

    IF p_period IS NULL OR lower(trim(p_period)) = 'monthly' THEN
        v_since := date_trunc('month', timezone('utc', now()));
    ELSIF lower(trim(p_period)) = 'total' THEN
        v_since := TIMESTAMPTZ '-infinity';
    ELSE
        v_since := TIMESTAMPTZ '-infinity';
    END IF;

    RETURN COALESCE(
        (
            SELECT COUNT(*)::INT
              FROM check_ins ci
             WHERE ci.profile_id = v_profile
               AND ci.outlet_id IS DISTINCT FROM v_home
               AND (
                   v_since = TIMESTAMPTZ '-infinity'
                   OR ci.checked_in_at >= v_since
               )
        ),
        0
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_effective_plan_settings(p_membership_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_mem gym_memberships%ROWTYPE;
    v_plan membership_plans%ROWTYPE;
BEGIN
    SELECT * INTO v_mem FROM gym_memberships WHERE id = p_membership_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'membership_not_found');
    END IF;

    IF v_mem.plan_id IS NOT NULL THEN
        SELECT * INTO v_plan FROM membership_plans WHERE id = v_mem.plan_id AND deleted_at IS NULL;

        IF NOT FOUND THEN
            -- Plan removed; behave like overrides-only.
            RETURN jsonb_build_object(
                'source', 'membership_override',
                'plan_name', v_mem.plan_name,
                'allow_cross_branch', v_mem.allow_cross_branch,
                'cross_branch_visits_allowed', v_mem.cross_branch_visits_allowed,
                'cross_branch_quota_period', v_mem.cross_branch_quota_period,
                'cross_branch_org_only', v_mem.cross_branch_org_only,
                'features', v_mem.plan_features_json
            );
        END IF;

        RETURN jsonb_build_object(
            'source', 'plan',
            'plan_name', v_plan.name,
            'allow_cross_branch', v_plan.allow_cross_branch,
            'cross_branch_visits_allowed', v_plan.cross_branch_visits_allowed,
            'cross_branch_quota_period', v_plan.cross_branch_quota_period,
            'cross_branch_org_only', v_plan.cross_branch_org_only,
            'features', v_plan.features_json
        );
    END IF;

    RETURN jsonb_build_object(
        'source', 'membership_override',
        'plan_name', v_mem.plan_name,
        'allow_cross_branch', v_mem.allow_cross_branch,
        'cross_branch_visits_allowed', v_mem.cross_branch_visits_allowed,
        'cross_branch_quota_period', v_mem.cross_branch_quota_period,
        'cross_branch_org_only', v_mem.cross_branch_org_only,
        'features', v_mem.plan_features_json
    );
END;
$$;

CREATE OR REPLACE FUNCTION can_cross_branch_visit(
    p_membership_id UUID,
    p_visited_outlet_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_membership gym_memberships%ROWTYPE;
    v_settings JSONB;
    v_home_org UUID;
    v_visited_org UUID;
    v_used INT;
    v_allowed INT;
    v_period TEXT;
    v_period_key TEXT;
    v_allowed_raw TEXT;
BEGIN
    SELECT * INTO v_membership
      FROM gym_memberships
     WHERE id = p_membership_id
       AND status = 'active'
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Membership not found or not active'
        );
    END IF;

    v_settings := get_effective_plan_settings(p_membership_id);

    IF (v_settings ? 'error') THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Unable to resolve plan settings');
    END IF;

    IF NOT (v_settings->>'allow_cross_branch')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Cross-branch visits not included in this plan: ' || (v_settings->>'plan_name'),
            'plan_name', v_settings->>'plan_name'
        );
    END IF;

    IF (v_settings->>'cross_branch_org_only')::BOOLEAN THEN
        SELECT organization_id INTO v_home_org FROM outlets WHERE id = v_membership.outlet_id;
        SELECT organization_id INTO v_visited_org FROM outlets WHERE id = p_visited_outlet_id;

        IF v_home_org IS DISTINCT FROM v_visited_org THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'This plan only allows visits within the same gym brand',
                'plan_name', v_settings->>'plan_name'
            );
        END IF;
    END IF;

    v_allowed_raw := v_settings->>'cross_branch_visits_allowed';

    IF v_allowed_raw IS NULL OR trim(v_allowed_raw) = '' OR lower(trim(v_allowed_raw)) = 'null' THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'reason', 'Unlimited cross-branch visits',
            'plan_name', v_settings->>'plan_name',
            'visits_used', NULL,
            'visits_allowed', NULL
        );
    END IF;

    v_period := COALESCE(trim(v_settings->>'cross_branch_quota_period'), 'monthly');
    v_period_key := CASE WHEN lower(v_period) = 'monthly'
                    THEN TO_CHAR(timezone('utc', NOW()), 'YYYY-MM')
                    ELSE 'total' END;
    v_allowed := v_allowed_raw::INT;
    v_used := get_cross_branch_usage(p_membership_id, v_period);

    IF v_used >= v_allowed THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', format('Monthly cross-branch visit limit reached (%s/%s)', v_used, v_allowed),
            'plan_name', v_settings->>'plan_name',
            'visits_used', v_used,
            'visits_allowed', v_allowed,
            'quota_period', v_period_key
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'OK',
        'plan_name', v_settings->>'plan_name',
        'visits_used', v_used,
        'visits_remaining', (v_allowed - v_used),
        'visits_allowed', v_allowed,
        'quota_period', v_period_key
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_cross_branch_usage(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_plan_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_cross_branch_visit(UUID, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_plans_all" ON membership_plans
    FOR ALL TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

CREATE POLICY "staff_plans_managed_outlets" ON membership_plans
    FOR ALL TO authenticated
    USING (i_manage_outlet(outlet_id))
    WITH CHECK (i_manage_outlet(outlet_id));

CREATE POLICY "customer_plans_read" ON membership_plans
    FOR SELECT TO authenticated
    USING (
        is_active = true
        AND deleted_at IS NULL
        AND outlet_id IN (
            SELECT outlet_id FROM gym_memberships
            WHERE profile_id = auth.uid()
              AND deleted_at IS NULL
        )
    );

