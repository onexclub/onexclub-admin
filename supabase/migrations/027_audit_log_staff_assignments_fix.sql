-- =============================================================================
-- Fix write_audit_log() for tables without updated_by / created_by (e.g. staff_assignments).
-- Without this, UPDATE/DELETE on staff_assignments fails with:
--   record "new" has no field "updated_by"
-- which breaks gym_owner branch sync (revoke + upsert after superadmin owner changes).
-- =============================================================================

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
    v_old_json  JSONB;
    v_new_json  JSONB;
BEGIN
    v_actor_id := auth.uid();

    IF TG_OP = 'DELETE' THEN
        v_old_json := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        v_new_json := to_jsonb(NEW);
    ELSE
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);
    END IF;

    IF v_actor_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            v_actor_id := COALESCE(
                NULLIF(v_old_json ->> 'updated_by', '')::uuid,
                NULLIF(v_old_json ->> 'assigned_by', '')::uuid
            );
        ELSIF TG_OP = 'INSERT' THEN
            v_actor_id := COALESCE(
                NULLIF(v_new_json ->> 'updated_by', '')::uuid,
                NULLIF(v_new_json ->> 'created_by', '')::uuid,
                NULLIF(v_new_json ->> 'assigned_by', '')::uuid
            );
        ELSE
            v_actor_id := COALESCE(
                NULLIF(v_new_json ->> 'updated_by', '')::uuid,
                NULLIF(v_new_json ->> 'assigned_by', '')::uuid
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_old_data  := v_old_json;
        v_record_id := OLD.id::TEXT;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data  := v_new_json;
        v_record_id := NEW.id::TEXT;
    ELSE
        v_old_data  := v_old_json;
        v_new_data  := v_new_json;
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

COMMENT ON FUNCTION write_audit_log() IS
  'Append-only audit writer; uses JSONB field access so tables without updated_by (staff_assignments) still audit safely.';
