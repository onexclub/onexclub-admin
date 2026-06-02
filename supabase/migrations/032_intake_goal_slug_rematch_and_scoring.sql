-- Fix plan mismatch when members change fitness goal (e.g. Weight Loss → Muscle Gain):
-- 1) intake_fitness_goal_fallbacks only understood Title Case labels, not option slugs (muscle_gain)
-- 2) trigger_auto_assign skipped re-assignment when active plans already existed
-- 3) question_score_rules missing slug answer values used by some question_definitions

-- ── Normalize intake goal label → primary_goal slug ─────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_fitness_goal_input(p_label TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN TRIM(COALESCE(p_label, '')) = '' THEN NULL
        -- slug form (question_definitions value field)
        WHEN LOWER(REPLACE(TRIM(p_label), ' ', '_')) IN (
            'weight_loss', 'muscle_gain', 'general_fitness', 'endurance', 'flexibility',
            'athletic_performance', 'rehabilitation', 'improve_endurance', 'increase_flexibility'
        ) THEN LOWER(REPLACE(TRIM(p_label), ' ', '_'))
        -- Title Case labels (staff / legacy forms)
        WHEN TRIM(p_label) = 'Weight Loss'           THEN 'weight_loss'
        WHEN TRIM(p_label) = 'Muscle Gain'           THEN 'muscle_gain'
        WHEN TRIM(p_label) = 'General Fitness'       THEN 'general_fitness'
        WHEN TRIM(p_label) = 'Improve Endurance'     THEN 'endurance'
        WHEN TRIM(p_label) = 'Increase Flexibility'  THEN 'flexibility'
        WHEN TRIM(p_label) = 'Athletic Performance'  THEN 'athletic_performance'
        WHEN TRIM(p_label) = 'Rehabilitation'        THEN 'rehabilitation'
        ELSE LOWER(REPLACE(TRIM(p_label), ' ', '_'))
    END;
$$;

CREATE OR REPLACE FUNCTION public.intake_fitness_goal_fallbacks(p_label TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE public.normalize_fitness_goal_input(p_label)
        WHEN 'weight_loss'           THEN ARRAY['weight_loss']::TEXT[]
        WHEN 'muscle_gain'           THEN ARRAY['muscle_gain', 'general_fitness']::TEXT[]
        WHEN 'athletic_performance'  THEN ARRAY['muscle_gain', 'general_fitness', 'endurance']::TEXT[]
        WHEN 'endurance'             THEN ARRAY['endurance', 'general_fitness']::TEXT[]
        WHEN 'improve_endurance'     THEN ARRAY['endurance', 'general_fitness']::TEXT[]
        WHEN 'flexibility'           THEN ARRAY['flexibility', 'general_fitness']::TEXT[]
        WHEN 'increase_flexibility'  THEN ARRAY['flexibility', 'general_fitness']::TEXT[]
        WHEN 'general_fitness'       THEN ARRAY['general_fitness', 'muscle_gain']::TEXT[]
        WHEN 'rehabilitation'        THEN ARRAY['general_fitness', 'flexibility']::TEXT[]
        ELSE ARRAY['general_fitness']::TEXT[]
    END;
$$;

-- ── Scoring: accept slug values stored by onboarding selects ─────────────────
INSERT INTO question_score_rules (form_name, question_key, answer_value, dimension, points, is_active, outlet_id)
SELECT v.form_name, v.question_key, v.answer_value, v.dimension, v.points, v.is_active, v.outlet_id
FROM (VALUES
  ('basic_info', 'fitness_goal', 'weight_loss', 'goal', 1, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'muscle_gain', 'goal', 3, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'general_fitness', 'goal', 2, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'endurance', 'goal', 2, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'flexibility', 'goal', 1, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'improve_endurance', 'goal', 2, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'increase_flexibility', 'goal', 1, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'athletic_performance', 'goal', 3, true, NULL::uuid),
  ('basic_info', 'fitness_goal', 'rehabilitation', 'goal', 1, true, NULL::uuid)
) AS v(form_name, question_key, answer_value, dimension, points, is_active, outlet_id)
WHERE NOT EXISTS (
  SELECT 1 FROM question_score_rules q
  WHERE q.form_name = v.form_name
    AND q.question_key = v.question_key
    AND q.answer_value = v.answer_value
    AND q.outlet_id IS NULL
);

-- ── Re-assign when intake driving fields change (not only first completion) ───
CREATE OR REPLACE FUNCTION public.trigger_auto_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_reason TEXT := 'initial';
    v_plan_fields_changed BOOLEAN := FALSE;
BEGIN
    IF NEW.is_complete IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.is_complete IS TRUE THEN
        IF NEW.form_name = 'basic_info' THEN
            v_plan_fields_changed := (
                OLD.answers_json->>'fitness_goal' IS DISTINCT FROM NEW.answers_json->>'fitness_goal'
                OR OLD.answers_json->>'experience_level' IS DISTINCT FROM NEW.answers_json->>'experience_level'
                OR OLD.answers_json->>'activity_level' IS DISTINCT FROM NEW.answers_json->>'activity_level'
                OR OLD.answers_json->>'workout_days_per_week' IS DISTINCT FROM NEW.answers_json->>'workout_days_per_week'
            );
        ELSIF NEW.form_name = 'diet_preferences' THEN
            v_plan_fields_changed := (
                OLD.answers_json->>'diet_type' IS DISTINCT FROM NEW.answers_json->>'diet_type'
            );
        ELSE
            RETURN NEW;
        END IF;

        IF NOT v_plan_fields_changed THEN
            RETURN NEW;
        END IF;

        v_reason := 'preference_change';
    ELSIF TG_OP = 'UPDATE' AND OLD.is_complete IS TRUE THEN
        RETURN NEW;
    END IF;

    IF NOT public.intake_sections_complete(NEW.profile_id, NEW.outlet_id) THEN
        RETURN NEW;
    END IF;

    -- Initial onboard only: skip if plans already assigned (staff may use manual rematch)
    IF v_reason = 'initial' AND EXISTS (
        SELECT 1
        FROM customer_plan_assignments
        WHERE profile_id = NEW.profile_id
          AND outlet_id = NEW.outlet_id
          AND status = 'active'
          AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    PERFORM public.assign_or_rotate_plans(
        NEW.profile_id,
        NEW.outlet_id,
        'basic_info',
        v_reason,
        NULL
    );

    RETURN NEW;
END;
$$;

-- ── Backfill: members whose active plan goal ≠ normalized intake goal ─────────
DO $$
DECLARE
    r RECORD;
    v_want TEXT;
    v_have TEXT;
BEGIN
    FOR r IN
        SELECT DISTINCT
            qr.profile_id,
            qr.outlet_id,
            public.normalize_fitness_goal_input(qr.answers_json->>'fitness_goal') AS want_goal
        FROM questions_responses qr
        WHERE qr.form_name = 'basic_info'
          AND qr.is_complete = TRUE
          AND qr.deleted_at IS NULL
          AND public.intake_sections_complete(qr.profile_id, qr.outlet_id)
    LOOP
        IF r.want_goal IS NULL THEN
            CONTINUE;
        END IF;

        SELECT pt.primary_goal INTO v_have
        FROM customer_plan_assignments cpa
        JOIN plan_templates pt ON pt.id = cpa.plan_template_id
        WHERE cpa.profile_id = r.profile_id
          AND cpa.outlet_id = r.outlet_id
          AND cpa.plan_type = 'exercise'
          AND cpa.status = 'active'
          AND cpa.deleted_at IS NULL
        LIMIT 1;

        IF v_have IS NULL THEN
            CONTINUE;
        END IF;

        IF v_have = ANY(
            public.intake_fitness_goal_fallbacks(
                (SELECT answers_json->>'fitness_goal'
                   FROM questions_responses
                  WHERE profile_id = r.profile_id
                    AND outlet_id = r.outlet_id
                    AND form_name = 'basic_info'
                    AND deleted_at IS NULL
                  LIMIT 1)
            )
        ) THEN
            CONTINUE;
        END IF;

        PERFORM public.compute_member_intake_score(r.profile_id, r.outlet_id);
        PERFORM public.assign_or_rotate_plans(
            r.profile_id, r.outlet_id, 'basic_info', 'preference_change', NULL
        );
    END LOOP;
END;
$$;
