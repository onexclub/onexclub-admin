-- Program plan fixes:
-- 1) assign_or_rotate_plans runs as SECURITY DEFINER (assignment_events inserts from triggers/RPC)
-- 2) Member-level intake scoring aligned with app form_name + answer labels
-- 3) Staff read access on assignment_events audit rows

-- ── Scoring rules for app intake sections (see question_definitions) ─────────
DELETE FROM question_score_rules
WHERE form_name IN ('basic_info', 'diet_preferences')
  AND outlet_id IS NULL;

INSERT INTO question_score_rules (form_name, question_key, answer_value, dimension, points, is_active, outlet_id)
VALUES
  -- basic_info.fitness_goal
  ('basic_info', 'fitness_goal', 'Weight Loss', 'goal', 1, true, NULL),
  ('basic_info', 'fitness_goal', 'Muscle Gain', 'goal', 3, true, NULL),
  ('basic_info', 'fitness_goal', 'Improve Endurance', 'goal', 2, true, NULL),
  ('basic_info', 'fitness_goal', 'Increase Flexibility', 'goal', 1, true, NULL),
  ('basic_info', 'fitness_goal', 'General Fitness', 'goal', 2, true, NULL),
  ('basic_info', 'fitness_goal', 'Athletic Performance', 'goal', 3, true, NULL),
  ('basic_info', 'fitness_goal', 'Rehabilitation', 'goal', 1, true, NULL),
  -- basic_info.experience_level
  ('basic_info', 'experience_level', 'Complete Beginner', 'fitness_level', 1, true, NULL),
  ('basic_info', 'experience_level', 'Less than 6 months', 'fitness_level', 1, true, NULL),
  ('basic_info', 'experience_level', '6 months - 1 year', 'fitness_level', 2, true, NULL),
  ('basic_info', 'experience_level', '1-3 years', 'fitness_level', 2, true, NULL),
  ('basic_info', 'experience_level', '3+ years', 'fitness_level', 3, true, NULL),
  -- basic_info.workout_days_per_week
  ('basic_info', 'workout_days_per_week', '1-2 days', 'frequency', 1, true, NULL),
  ('basic_info', 'workout_days_per_week', '3-4 days', 'frequency', 2, true, NULL),
  ('basic_info', 'workout_days_per_week', '5-6 days', 'frequency', 3, true, NULL),
  ('basic_info', 'workout_days_per_week', 'Every day', 'frequency', 3, true, NULL),
  -- basic_info.activity_level
  ('basic_info', 'activity_level', 'Sedentary (desk job, little movement)', 'activity', 1, true, NULL),
  ('basic_info', 'activity_level', 'Lightly Active (walk occasionally)', 'activity', 1, true, NULL),
  ('basic_info', 'activity_level', 'Moderately Active (exercise 2-3x/week)', 'activity', 2, true, NULL),
  ('basic_info', 'activity_level', 'Very Active (exercise 4-5x/week)', 'activity', 3, true, NULL),
  ('basic_info', 'activity_level', 'Athlete (daily intense training)', 'activity', 3, true, NULL),
  -- diet_preferences.diet_type
  ('diet_preferences', 'diet_type', 'Vegetarian', 'diet', 1, true, NULL),
  ('diet_preferences', 'diet_type', 'Non-Vegetarian', 'diet', 2, true, NULL),
  ('diet_preferences', 'diet_type', 'Vegan', 'diet', 1, true, NULL),
  ('diet_preferences', 'diet_type', 'Eggetarian', 'diet', 1, true, NULL),
  ('diet_preferences', 'diet_type', 'Pescatarian', 'diet', 2, true, NULL),
  ('diet_preferences', 'diet_type', 'Keto', 'diet', 2, true, NULL),
  ('diet_preferences', 'diet_type', 'Intermittent Fasting', 'diet', 2, true, NULL),
  ('diet_preferences', 'diet_type', 'No Specific Diet', 'diet', 1, true, NULL);

-- ── Aggregate score across all completed intake sections ─────────────────────
CREATE OR REPLACE FUNCTION public.compute_member_intake_score(
    p_profile_id UUID,
    p_outlet_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec     questions_responses%ROWTYPE;
    v_rules   question_score_rules%ROWTYPE;
    v_vec     jsonb := '{}';
    v_total   integer := 0;
    v_ans     text;
    v_pts     integer;
    v_store   UUID;
BEGIN
    FOR v_rec IN
        SELECT *
        FROM questions_responses
        WHERE profile_id = p_profile_id
          AND outlet_id = p_outlet_id
          AND deleted_at IS NULL
          AND is_complete = TRUE
          AND form_name IN ('basic_info', 'health_screening', 'diet_preferences')
    LOOP
        IF v_store IS NULL OR v_rec.form_name = 'basic_info' THEN
            v_store := v_rec.id;
        END IF;

        FOR v_rules IN
            SELECT *
            FROM question_score_rules
            WHERE form_name = v_rec.form_name
              AND is_active = TRUE
              AND (outlet_id = v_rec.outlet_id OR outlet_id IS NULL)
        LOOP
            v_ans := v_rec.answers_json ->> v_rules.question_key;
            IF v_ans IS NOT NULL AND v_ans = v_rules.answer_value THEN
                v_pts := COALESCE((v_vec ->> v_rules.dimension)::integer, 0) + v_rules.points;
                v_vec := jsonb_set(v_vec, ARRAY[v_rules.dimension], to_jsonb(v_pts));
                v_total := v_total + v_rules.points;
            END IF;
        END LOOP;
    END LOOP;

    IF v_store IS NOT NULL THEN
        UPDATE questions_responses
           SET intake_score = v_total,
               score_vector = v_vec,
               score_computed_at = NOW()
         WHERE id = v_store;
    END IF;

    RETURN v_total;
END;
$$;

ALTER FUNCTION public.compute_member_intake_score(UUID, UUID) SECURITY DEFINER;

-- Legacy single-row scorer — delegate to member aggregate when possible
CREATE OR REPLACE FUNCTION public.compute_intake_score(p_response_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec questions_responses%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM questions_responses WHERE id = p_response_id;
    IF v_rec.id IS NULL THEN
        RETURN;
    END IF;
    PERFORM public.compute_member_intake_score(v_rec.profile_id, v_rec.outlet_id);
END;
$$;

ALTER FUNCTION public.compute_intake_score(UUID) SECURITY DEFINER;

ALTER FUNCTION public.assign_or_rotate_plans(UUID, UUID, TEXT, TEXT, UUID)
    SECURITY DEFINER
    SET search_path = public;

-- assignment_events: RLS enabled but no policies blocked staff reads/writes via RPC
ALTER TABLE assignment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read_assignment_events ON assignment_events;
CREATE POLICY staff_read_assignment_events ON assignment_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_assignments sa
            WHERE sa.profile_id = auth.uid()
              AND sa.outlet_id = assignment_events.outlet_id
              AND sa.revoked_at IS NULL
        )
    );

DROP POLICY IF EXISTS customer_read_own_assignment_events ON assignment_events;
CREATE POLICY customer_read_own_assignment_events ON assignment_events
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- Backfill scores for members with complete intake
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT profile_id, outlet_id
        FROM questions_responses
        WHERE deleted_at IS NULL
          AND is_complete = TRUE
          AND public.intake_sections_complete(profile_id, outlet_id)
    LOOP
        PERFORM public.compute_member_intake_score(r.profile_id, r.outlet_id);
    END LOOP;
END;
$$;
