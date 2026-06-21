-- Hard-filter + AI review columns for plan_templates (unified diet + exercise catalogue).
-- This project uses ONE table (`plan_templates` + plan_type) — not separate diet_templates /
-- exercise_templates. Matching columns map as:
--   goal        → primary_goal
--   level       → difficulty_level
--   gender      → target_gender (NULL = any / unisex)
--   constraints → constraints (new TEXT[])

-- ── AI / review metadata on plan_templates ───────────────────────────────────
ALTER TABLE plan_templates
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
        CHECK (source IN ('manual', 'ai_generated'));

ALTER TABLE plan_templates
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'pending_review', 'rejected'));

ALTER TABLE plan_templates
    ADD COLUMN IF NOT EXISTS created_by_ai_at TIMESTAMPTZ;

ALTER TABLE plan_templates
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);

ALTER TABLE plan_templates
    ADD COLUMN IF NOT EXISTS match_count INT DEFAULT 0;

ALTER TABLE plan_templates
    ADD COLUMN IF NOT EXISTS constraints TEXT[] DEFAULT '{}';

COMMENT ON COLUMN plan_templates.constraints IS
    'Hard-filter tags this template is NOT suitable for (e.g. knee_injury, dairy). '
    'Excluded when array intersects member injuries/allergies — see template-matching lib.';

COMMENT ON COLUMN plan_templates.status IS
    'active = trusted catalogue; pending_review = AI-generated awaiting staff; rejected = hidden.';

-- Backfill: existing rows are verified manual templates
UPDATE plan_templates
   SET source = 'manual',
       status = 'active'
 WHERE source IS NULL OR status IS NULL;

CREATE INDEX IF NOT EXISTS idx_plan_templates_hard_match
    ON plan_templates (plan_type, primary_goal, difficulty_level, target_gender, status)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- ── Gap tracking when no template passes hard filters ────────────────────────
CREATE TABLE IF NOT EXISTS template_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type TEXT NOT NULL CHECK (template_type IN ('diet', 'exercise')),
    goal TEXT NOT NULL,
    level TEXT NOT NULL,
    gender TEXT NOT NULL,
    constraints TEXT[] DEFAULT '{}',
    hit_count INT DEFAULT 1,
    last_requested_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (template_type, goal, level, gender, constraints)
);

ALTER TABLE template_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_template_gaps" ON template_gaps
    FOR SELECT TO authenticated
    USING (
        is_superadmin()
        OR EXISTS (
            SELECT 1 FROM staff_assignments sa
            WHERE sa.profile_id = auth.uid()
              AND sa.revoked_at IS NULL
              AND sa.role IN ('gym_owner', 'branch_admin', 'trainer')
        )
    );

CREATE POLICY "service_role_template_gaps_all" ON template_gaps
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ── Upsert gap row (callable from SQL auto-assign when picker returns NULL) ──
CREATE OR REPLACE FUNCTION public.log_template_gap(
    p_template_type TEXT,
    p_goal TEXT,
    p_level TEXT,
    p_gender TEXT,
    p_constraints TEXT[] DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO template_gaps (template_type, goal, level, gender, constraints, hit_count, last_requested_at)
    VALUES (
        p_template_type,
        p_goal,
        p_level,
        p_gender,
        COALESCE(p_constraints, '{}'),
        1,
        now()
    )
    ON CONFLICT (template_type, goal, level, gender, constraints)
    DO UPDATE SET
        hit_count = template_gaps.hit_count + 1,
        last_requested_at = now();
END;
$$;

-- ── Hard-filter picker (goal + level + gender exact; no score averaging) ─────
-- Soft preferences (diet tag, age, BMI, score proximity) are ORDER BY tiebreakers only.
CREATE OR REPLACE FUNCTION public.pick_plan_template(
    p_outlet_id UUID,
    p_plan_type TEXT,
    p_tier TEXT,
    p_fitness_goal_label TEXT,
    p_gender TEXT,
    p_age INTEGER,
    p_bmi NUMERIC,
    p_score INTEGER,
    p_exclude_template_id UUID,
    p_diet_type_label TEXT DEFAULT NULL
)
RETURNS plan_templates
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_goal      TEXT;
    v_goals     TEXT[];
    v_diet_tag  TEXT;
    v_plan      plan_templates%ROWTYPE;
    v_norm_goal TEXT;
BEGIN
    v_norm_goal := public.normalize_fitness_goal_input(p_fitness_goal_label);
    v_goals := public.intake_fitness_goal_fallbacks(p_fitness_goal_label);
    v_diet_tag := public.map_diet_type_tag(p_diet_type_label);

    -- Hard filter: exact goal slug (first fallback only), exact tier, gender-safe, status active.
    -- Goal/level/gender are NEVER averaged into a score — they are WHERE predicates.
    FOREACH v_goal IN ARRAY v_goals LOOP
        SELECT pt.* INTO v_plan
          FROM plan_templates pt
         WHERE pt.plan_type = p_plan_type
           AND pt.is_active = TRUE
           AND pt.deleted_at IS NULL
           AND pt.status = 'active'
           AND pt.difficulty_level = p_tier
           AND pt.primary_goal = v_goal
           AND (pt.outlet_id = p_outlet_id OR pt.outlet_id IS NULL)
           AND (p_exclude_template_id IS NULL OR pt.id <> p_exclude_template_id)
           AND (
                pt.target_gender IS NULL
                OR pt.target_gender = p_gender
           )
         ORDER BY
           -- Soft score tiebreakers only (secondary preferences)
           CASE WHEN pt.outlet_id IS NOT NULL THEN 0 ELSE 1 END,
           CASE
             WHEN p_plan_type = 'diet' AND v_diet_tag IS NOT NULL AND v_diet_tag = ANY (pt.tags) THEN 0
             WHEN p_plan_type = 'diet' AND v_diet_tag IS NOT NULL THEN 1
             ELSE 0
           END,
           CASE
             WHEN pt.min_age IS NOT NULL AND pt.max_age IS NOT NULL
                  AND p_age BETWEEN pt.min_age AND pt.max_age THEN 0
             WHEN pt.min_age IS NULL AND pt.max_age IS NULL THEN 1
             ELSE 2
           END,
           CASE
             WHEN pt.min_bmi IS NOT NULL AND pt.max_bmi IS NOT NULL
                  AND COALESCE(p_bmi, 22) BETWEEN pt.min_bmi AND pt.max_bmi THEN 0
             WHEN pt.min_bmi IS NULL AND pt.max_bmi IS NULL THEN 1
             ELSE 2
           END,
           ABS(COALESCE(p_score, 15) - ((COALESCE(pt.min_score, 0) + COALESCE(pt.max_score, 30)) / 2.0)),
           pt.match_count DESC
         LIMIT 1;

        IF v_plan.id IS NOT NULL THEN
            UPDATE plan_templates
               SET match_count = COALESCE(match_count, 0) + 1
             WHERE id = v_plan.id;
            RETURN v_plan;
        END IF;

        EXIT WHEN v_goal = v_norm_goal;
    END LOOP;

    -- Log gap for analytics / AI backfill queue
    PERFORM public.log_template_gap(
        p_plan_type,
        COALESCE(v_norm_goal, 'general_fitness'),
        p_tier,
        COALESCE(p_gender, 'any'),
        '{}'::TEXT[]
    );

    RETURN v_plan;
END;
$$;
