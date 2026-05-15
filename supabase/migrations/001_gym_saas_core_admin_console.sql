-- =============================================================================
-- Gym SaaS — core tables + RLS for this admin console (fresh database bootstrap)
-- If you already applied the full v1.0 migration from your platform spec, skip this file.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('superadmin', 'gym_owner', 'branch_admin', 'receptionist', 'trainer', 'customer');
CREATE TYPE membership_status AS ENUM ('active', 'inactive', 'suspended', 'expired', 'pending');
CREATE TYPE plan_tier AS ENUM ('basic', 'standard', 'premium', 'enterprise');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'half_yearly', 'yearly');

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    plan_tier plan_tier NOT NULL DEFAULT 'basic',
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_outlets INT NOT NULL DEFAULT 5,
    contact_email TEXT,
    contact_phone TEXT,
    address_json JSONB,
    settings_json JSONB,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    country CHAR(2) DEFAULT 'IN',
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    opening_hours JSONB,
    amenities_json JSONB,
    capacity INT DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_superadmin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE staff_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    role user_role NOT NULL CHECK (role IN ('gym_owner', 'branch_admin', 'receptionist', 'trainer')),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES profiles(id),
    notes TEXT,
    UNIQUE (profile_id, outlet_id)
);

CREATE TABLE gym_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'customer',
    status membership_status NOT NULL DEFAULT 'pending',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    billing_cycle billing_cycle,
    plan_name TEXT,
    plan_features_json JSONB,
    amount_paid NUMERIC(10,2),
    currency CHAR(3) DEFAULT 'INR',
    onboarded_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (profile_id, outlet_id)
);

CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    method TEXT DEFAULT 'manual',
    recorded_by UUID REFERENCES profiles(id),
    notes TEXT
);

CREATE INDEX idx_org_active ON organizations(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_outlet_org ON outlets(organization_id);
CREATE INDEX idx_staff_profile ON staff_assignments(profile_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_staff_outlet ON staff_assignments(outlet_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_mem_outlet ON gym_memberships(outlet_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ci_outlet_time ON check_ins(outlet_id, checked_in_at DESC);

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT is_superadmin FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL),
        false
    );
$$;

CREATE OR REPLACE FUNCTION my_staff_outlet_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT outlet_id FROM staff_assignments
    WHERE profile_id = auth.uid() AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION i_manage_outlet(p_outlet_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT
        p_outlet_id = ANY(ARRAY(SELECT my_staff_outlet_ids()))
        OR EXISTS (
            SELECT 1
            FROM staff_assignments sa
            JOIN outlets my_o ON my_o.id = sa.outlet_id
            JOIN outlets target ON target.id = p_outlet_id
            WHERE sa.profile_id = auth.uid()
              AND sa.role = 'gym_owner'
              AND sa.revoked_at IS NULL
              AND my_o.organization_id = target.organization_id
        );
$$;

CREATE OR REPLACE FUNCTION i_can_see_member(p_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM gym_memberships
        WHERE profile_id = p_profile_id
          AND outlet_id = ANY(ARRAY(SELECT my_staff_outlet_ids()))
          AND deleted_at IS NULL
    );
$$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_orgs_all" ON organizations
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "staff_orgs_read" ON organizations
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT o.organization_id
            FROM staff_assignments sa
            JOIN outlets o ON o.id = sa.outlet_id
            WHERE sa.profile_id = auth.uid() AND sa.revoked_at IS NULL
        )
    );

CREATE POLICY "gym_owner_orgs_update" ON organizations
    FOR UPDATE TO authenticated
    USING (
        id IN (
            SELECT o.organization_id
            FROM staff_assignments sa
            JOIN outlets o ON o.id = sa.outlet_id
            WHERE sa.profile_id = auth.uid()
              AND sa.role = 'gym_owner'
              AND sa.revoked_at IS NULL
        )
    )
    WITH CHECK (
        id IN (
            SELECT o.organization_id
            FROM staff_assignments sa
            JOIN outlets o ON o.id = sa.outlet_id
            WHERE sa.profile_id = auth.uid()
              AND sa.role = 'gym_owner'
              AND sa.revoked_at IS NULL
        )
    );

CREATE POLICY "superadmin_outlets_all" ON outlets
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "branch_mgmt_outlets_mutate" ON outlets
    FOR ALL TO authenticated
    USING (i_manage_outlet(id))
    WITH CHECK (i_manage_outlet(id));

CREATE POLICY "staff_outlets_read" ON outlets
    FOR SELECT TO authenticated
    USING (id = ANY(ARRAY(SELECT my_staff_outlet_ids())));

CREATE POLICY "customer_outlets_read" ON outlets
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT outlet_id FROM gym_memberships
            WHERE profile_id = auth.uid() AND deleted_at IS NULL
        )
    );

CREATE POLICY "superadmin_profiles_all" ON profiles
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "own_profile_read" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "own_profile_update" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND is_superadmin = false);

CREATE POLICY "own_profile_insert" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "staff_read_member_profiles" ON profiles
    FOR SELECT TO authenticated
    USING (i_can_see_member(id));

CREATE POLICY "branch_mgmt_read_staff_profiles" ON profiles
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT sa.profile_id FROM staff_assignments sa
            JOIN outlets o ON o.id = sa.outlet_id
            WHERE o.organization_id IN (
                SELECT DISTINCT o2.organization_id
                FROM staff_assignments sa2
                JOIN outlets o2 ON o2.id = sa2.outlet_id
                WHERE sa2.profile_id = auth.uid()
                  AND sa2.role IN ('gym_owner', 'branch_admin')
                  AND sa2.revoked_at IS NULL
            )
            AND sa.revoked_at IS NULL
        )
    );

CREATE POLICY "superadmin_staff_all" ON staff_assignments
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "branch_mgmt_staff_assignments_all" ON staff_assignments
    FOR ALL TO authenticated
    USING (i_manage_outlet(outlet_id)) WITH CHECK (i_manage_outlet(outlet_id));

CREATE POLICY "staff_own_assignment_read" ON staff_assignments
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

CREATE POLICY "superadmin_memberships_all" ON gym_memberships
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "staff_memberships_all" ON gym_memberships
    FOR ALL TO authenticated
    USING (i_manage_outlet(outlet_id)) WITH CHECK (i_manage_outlet(outlet_id));

CREATE POLICY "customer_own_membership_read" ON gym_memberships
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

CREATE POLICY "superadmin_checkins_all" ON check_ins
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "staff_checkins_outlet" ON check_ins
    FOR ALL TO authenticated
    USING (i_manage_outlet(outlet_id)) WITH CHECK (i_manage_outlet(outlet_id));

CREATE POLICY "customer_own_checkins_read" ON check_ins
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER touch_organizations BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_outlets BEFORE UPDATE ON outlets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_memberships BEFORE UPDATE ON gym_memberships FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
