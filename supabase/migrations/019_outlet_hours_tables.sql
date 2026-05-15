-- ================================================================
-- Outlet operating hours: relational model (replaces JSON on outlets)
-- Split shifts (morning + evening), 24h, dated exceptions.
-- Safe to re-run: IF NOT EXISTS + DROP POLICY IF EXISTS where needed.
-- ================================================================

ALTER TABLE outlets DROP COLUMN IF EXISTS opening_hours;

CREATE TABLE IF NOT EXISTS outlet_hours (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id       UUID        NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    day_of_week     SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    shift_number    SMALLINT    NOT NULL DEFAULT 1 CHECK (shift_number IN (1, 2)),
    is_closed       BOOLEAN     NOT NULL DEFAULT false,
    is_24_hours     BOOLEAN     NOT NULL DEFAULT false,
    open_time       TIME,
    close_time      TIME,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (outlet_id, day_of_week, shift_number),

    CONSTRAINT chk_hours_times_required CHECK (
        is_closed = true
        OR is_24_hours = true
        OR (open_time IS NOT NULL AND close_time IS NOT NULL)
    ),
    CONSTRAINT chk_hours_close_after_open CHECK (
        is_closed = true
        OR is_24_hours = true
        OR close_time > open_time
    ),
    CONSTRAINT chk_hours_shift2_not_24h CHECK (
        shift_number = 1
        OR (shift_number = 2 AND is_closed = false AND is_24_hours = false)
    )
);

CREATE INDEX IF NOT EXISTS idx_hours_outlet ON outlet_hours(outlet_id);
CREATE INDEX IF NOT EXISTS idx_hours_outlet_day ON outlet_hours(outlet_id, day_of_week);

DROP TRIGGER IF EXISTS touch_outlet_hours ON outlet_hours;
CREATE TRIGGER touch_outlet_hours
    BEFORE UPDATE ON outlet_hours
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS outlet_hour_exceptions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id       UUID        NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    exception_date  DATE        NOT NULL,
    shift_number    SMALLINT    NOT NULL DEFAULT 1 CHECK (shift_number IN (1, 2)),
    is_closed       BOOLEAN     NOT NULL DEFAULT false,
    is_24_hours     BOOLEAN     NOT NULL DEFAULT false,
    open_time       TIME,
    close_time      TIME,
    reason          TEXT,
    created_by      UUID        REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (outlet_id, exception_date, shift_number),

    CONSTRAINT chk_exc_times_required CHECK (
        is_closed = true
        OR is_24_hours = true
        OR (open_time IS NOT NULL AND close_time IS NOT NULL)
    ),
    CONSTRAINT chk_exc_close_after_open CHECK (
        is_closed = true
        OR is_24_hours = true
        OR close_time > open_time
    )
);

CREATE INDEX IF NOT EXISTS idx_exc_outlet ON outlet_hour_exceptions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_exc_outlet_date ON outlet_hour_exceptions(outlet_id, exception_date);

DROP TRIGGER IF EXISTS touch_outlet_hour_exceptions ON outlet_hour_exceptions;
CREATE TRIGGER touch_outlet_hour_exceptions
    BEFORE UPDATE ON outlet_hour_exceptions
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION get_outlet_hours_today(p_outlet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_dow       SMALLINT := EXTRACT(DOW FROM CURRENT_DATE)::SMALLINT;
    v_exc       outlet_hour_exceptions%ROWTYPE;
    v_shifts    JSONB    := '[]'::JSONB;
    v_row       outlet_hours%ROWTYPE;
BEGIN
    SELECT * INTO v_exc
    FROM outlet_hour_exceptions
    WHERE outlet_id    = p_outlet_id
      AND exception_date = CURRENT_DATE
    ORDER BY shift_number
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'source',      'exception',
            'reason',      v_exc.reason,
            'is_closed',   v_exc.is_closed,
            'is_24_hours', v_exc.is_24_hours,
            'shifts', CASE
                WHEN v_exc.is_closed   THEN '[]'::JSONB
                WHEN v_exc.is_24_hours THEN '[{"shift":1,"open":"00:00","close":"23:59"}]'::JSONB
                ELSE jsonb_build_array(jsonb_build_object(
                    'shift', v_exc.shift_number,
                    'open',  to_char(v_exc.open_time,  'HH24:MI'),
                    'close', to_char(v_exc.close_time, 'HH24:MI')
                ))
            END
        );
    END IF;

    FOR v_row IN
        SELECT * FROM outlet_hours
        WHERE outlet_id    = p_outlet_id
          AND day_of_week  = v_dow
        ORDER BY shift_number
    LOOP
        IF v_row.is_closed THEN
            RETURN jsonb_build_object(
                'source',      'weekly_schedule',
                'is_closed',   true,
                'is_24_hours', false,
                'shifts',      '[]'::JSONB
            );
        ELSIF v_row.is_24_hours THEN
            RETURN jsonb_build_object(
                'source',      'weekly_schedule',
                'is_closed',   false,
                'is_24_hours', true,
                'shifts',      '[{"shift":1,"open":"00:00","close":"23:59"}]'::JSONB
            );
        ELSE
            v_shifts := v_shifts || jsonb_build_object(
                'shift', v_row.shift_number,
                'open',  to_char(v_row.open_time,  'HH24:MI'),
                'close', to_char(v_row.close_time, 'HH24:MI')
            );
        END IF;
    END LOOP;

    IF v_shifts = '[]'::JSONB THEN
        RETURN jsonb_build_object(
            'source',    'not_configured',
            'is_closed', false,
            'shifts',    '[]'::JSONB
        );
    END IF;

    RETURN jsonb_build_object(
        'source',      'weekly_schedule',
        'is_closed',   false,
        'is_24_hours', false,
        'shifts',      v_shifts
    );
END;
$$;

ALTER TABLE outlet_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_hours_all" ON outlet_hours;
CREATE POLICY "superadmin_hours_all" ON outlet_hours
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "admin_hours_all" ON outlet_hours;
CREATE POLICY "admin_hours_all" ON outlet_hours
    FOR ALL TO authenticated
    USING (i_manage_outlet(outlet_id))
    WITH CHECK (i_manage_outlet(outlet_id));

DROP POLICY IF EXISTS "member_hours_read" ON outlet_hours;
CREATE POLICY "member_hours_read" ON outlet_hours
    FOR SELECT TO authenticated
    USING (
        outlet_id IN (
            SELECT outlet_id FROM gym_memberships
            WHERE profile_id = auth.uid()
              AND deleted_at IS NULL
        )
    );

ALTER TABLE outlet_hour_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_exc_all" ON outlet_hour_exceptions;
CREATE POLICY "superadmin_exc_all" ON outlet_hour_exceptions
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "admin_exc_all" ON outlet_hour_exceptions;
CREATE POLICY "admin_exc_all" ON outlet_hour_exceptions
    FOR ALL TO authenticated
    USING (i_manage_outlet(outlet_id))
    WITH CHECK (i_manage_outlet(outlet_id));

DROP POLICY IF EXISTS "member_exc_read" ON outlet_hour_exceptions;
CREATE POLICY "member_exc_read" ON outlet_hour_exceptions
    FOR SELECT TO authenticated
    USING (
        outlet_id IN (
            SELECT outlet_id FROM gym_memberships
            WHERE profile_id = auth.uid()
              AND deleted_at IS NULL
        )
    );
