-- =============================================================================
-- Audit tracking: created_by / updated_by + append-only audit_log
--
-- Run in Supabase SQL editor as two blocks if you prefer (columns first, then
-- triggers), or apply the whole file via `supabase db push`.
--
-- App layer: triggers fill NULL cols from auth.uid() on the user-scoped client.
-- Service-role writes must pass actor ids explicitly — see
-- `src/lib/supabase/audit-columns.ts`.
-- =============================================================================

-- ── audit_log (full row history for sensitive tables) ────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action      audit_action NOT NULL,
    table_name  TEXT NOT NULL,
    record_id   TEXT,
    old_data    JSONB,
    new_data    JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log (table_name, record_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_id, occurred_at DESC);

COMMENT ON TABLE audit_log IS
  'Append-only change history; populated by write_audit_log() triggers. Query from admin tooling — see migration footer comments.';

-- ════════════════════════════════════════════════════════════════
-- EXECUTION 1 — Add created_by / updated_by columns
-- ════════════════════════════════════════════════════════════════

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE outlets
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE gym_memberships
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- diet_plans / exercise_plans already track creator as created_by_profile
ALTER TABLE diet_plans
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE exercise_plans
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE membership_plans
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
-- membership_plans.created_by exists from 004_membership_plans.sql

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Future tables (v1.0 platform pack) — no-op until those tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'body_metrics') THEN
    ALTER TABLE body_metrics
        ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slot_bookings') THEN
    ALTER TABLE slot_bookings
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slots') THEN
    ALTER TABLE slots
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- EXECUTION 2 — Triggers
-- ════════════════════════════════════════════════════════════════

-- Tables with both created_by and updated_by
CREATE OR REPLACE FUNCTION auto_set_audit_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.created_by IS NULL THEN
            NEW.created_by := auth.uid();
        END IF;
        IF NEW.updated_by IS NULL THEN
            NEW.updated_by := auth.uid();
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.updated_by IS NULL THEN
            NEW.updated_by := auth.uid();
        END IF;
        NEW.created_by := OLD.created_by;
    END IF;
    RETURN NEW;
END;
$$;

-- profiles + diet/exercise (updated_by only; diet/exercise creator = created_by_profile)
CREATE OR REPLACE FUNCTION auto_set_updated_by_col()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.updated_by IS NULL THEN
            NEW.updated_by := auth.uid();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_cols_organizations ON organizations;
DROP TRIGGER IF EXISTS audit_cols_outlets ON outlets;
DROP TRIGGER IF EXISTS audit_cols_gym_memberships ON gym_memberships;
DROP TRIGGER IF EXISTS audit_cols_slot_bookings ON slot_bookings;
DROP TRIGGER IF EXISTS audit_cols_membership_plans ON membership_plans;
DROP TRIGGER IF EXISTS audit_cols_slots ON slots;
DROP TRIGGER IF EXISTS audit_cols_profiles ON profiles;
DROP TRIGGER IF EXISTS audit_cols_diet_plans ON diet_plans;
DROP TRIGGER IF EXISTS audit_cols_exercise_plans ON exercise_plans;

CREATE TRIGGER audit_cols_organizations
    BEFORE INSERT OR UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION auto_set_audit_cols();

CREATE TRIGGER audit_cols_outlets
    BEFORE INSERT OR UPDATE ON outlets
    FOR EACH ROW EXECUTE FUNCTION auto_set_audit_cols();

CREATE TRIGGER audit_cols_gym_memberships
    BEFORE INSERT OR UPDATE ON gym_memberships
    FOR EACH ROW EXECUTE FUNCTION auto_set_audit_cols();

CREATE TRIGGER audit_cols_membership_plans
    BEFORE INSERT OR UPDATE ON membership_plans
    FOR EACH ROW EXECUTE FUNCTION auto_set_audit_cols();

CREATE TRIGGER audit_cols_profiles
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION auto_set_updated_by_col();

CREATE TRIGGER audit_cols_diet_plans
    BEFORE INSERT OR UPDATE ON diet_plans
    FOR EACH ROW EXECUTE FUNCTION auto_set_updated_by_col();

CREATE TRIGGER audit_cols_exercise_plans
    BEFORE INSERT OR UPDATE ON exercise_plans
    FOR EACH ROW EXECUTE FUNCTION auto_set_updated_by_col();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slot_bookings') THEN
    EXECUTE $tr$
      CREATE TRIGGER audit_cols_slot_bookings
          BEFORE INSERT OR UPDATE ON slot_bookings
          FOR EACH ROW EXECUTE FUNCTION auto_set_audit_cols()
    $tr$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slots') THEN
    EXECUTE $tr$
      CREATE TRIGGER audit_cols_slots
          BEFORE INSERT OR UPDATE ON slots
          FOR EACH ROW EXECUTE FUNCTION auto_set_audit_cols()
    $tr$;
  END IF;
END $$;

-- ── Append-only audit_log writer ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_data  JSONB := NULL;
    v_new_data  JSONB := NULL;
    v_record_id TEXT;
    v_actor_id  UUID;
BEGIN
    -- Service-role API calls have no JWT; fall back to row audit columns set in app code.
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            v_actor_id := OLD.updated_by;
        ELSIF TG_OP = 'INSERT' THEN
            v_actor_id := COALESCE(NEW.updated_by, NEW.created_by);
        ELSE
            v_actor_id := NEW.updated_by;
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        v_old_data  := to_jsonb(OLD);
        v_record_id := OLD.id::TEXT;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data  := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
    ELSE
        v_old_data  := to_jsonb(OLD);
        v_new_data  := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
    END IF;

    INSERT INTO audit_log (
        actor_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        occurred_at
    ) VALUES (
        v_actor_id,
        TG_OP::audit_action,
        TG_TABLE_NAME,
        v_record_id,
        v_old_data,
        v_new_data,
        NOW()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_log_profiles ON profiles;
DROP TRIGGER IF EXISTS audit_log_gym_memberships ON gym_memberships;
DROP TRIGGER IF EXISTS audit_log_staff_assignments ON staff_assignments;
DROP TRIGGER IF EXISTS audit_log_diet_plans ON diet_plans;
DROP TRIGGER IF EXISTS audit_log_exercise_plans ON exercise_plans;
DROP TRIGGER IF EXISTS audit_log_membership_plans ON membership_plans;
DROP TRIGGER IF EXISTS audit_log_organizations ON organizations;
DROP TRIGGER IF EXISTS audit_log_outlets ON outlets;

CREATE TRIGGER audit_log_profiles
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_gym_memberships
    AFTER INSERT OR UPDATE OR DELETE ON gym_memberships
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_staff_assignments
    AFTER INSERT OR UPDATE OR DELETE ON staff_assignments
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_diet_plans
    AFTER INSERT OR UPDATE OR DELETE ON diet_plans
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_exercise_plans
    AFTER INSERT OR UPDATE OR DELETE ON exercise_plans
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_membership_plans
    AFTER INSERT OR UPDATE OR DELETE ON membership_plans
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_organizations
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER audit_log_outlets
    AFTER INSERT OR UPDATE OR DELETE ON outlets
    FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- Example: who onboarded a customer (prefer created_by; onboarded_by kept for legacy UI)
-- SELECT gm.created_at, p_staff.full_name AS onboarded_by
-- FROM gym_memberships gm
-- LEFT JOIN profiles p_staff ON p_staff.id = COALESCE(gm.created_by, gm.onboarded_by)
-- WHERE gm.profile_id = 'CUSTOMER-UUID' ORDER BY gm.created_at DESC;
