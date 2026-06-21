-- Simplify diet intake: Vegetarian | Non-Vegetarian | Vegan + eats_eggs follow-up.
-- Fix eggetarian templates showing empty days (duration_weeks=4 but only week 1 seeded).

-- ── 1. Main diet options (remove Eggetarian / Keto / IF from primary select) ──
UPDATE question_definitions
SET options_json = '["Vegetarian","Non-Vegetarian","Vegan","No Specific Diet"]'::jsonb,
    label = 'What best describes your diet?',
    updated_at = now()
WHERE form_name = 'diet_preferences'
  AND question_key = 'diet_type'
  AND outlet_id IS NULL
  AND deleted_at IS NULL;

-- ── 2. Vegetarian follow-up: Do you eat eggs? ──
INSERT INTO question_definitions (
    outlet_id, form_name, question_key, label, helper_text,
    input_type, options_json, is_required, display_order, is_active, editable_by_customer,
    visibility_json
)
SELECT
    NULL,
    'diet_preferences',
    'eats_eggs',
    'Do you eat eggs?',
    'Common in North India — anda bhurji, boiled eggs with roti. Only shown for vegetarian members.',
    'boolean',
    NULL,
    true,
    15,
    true,
    true,
    '{"show_when":{"question_key":"diet_type","values":["Vegetarian"]}}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM question_definitions
    WHERE form_name = 'diet_preferences' AND question_key = 'eats_eggs' AND outlet_id IS NULL
);

-- ── 3. Optional special diet style (keto, IF, pescatarian) ──
INSERT INTO question_definitions (
    outlet_id, form_name, question_key, label, helper_text,
    input_type, options_json, is_required, display_order, is_active, editable_by_customer
)
SELECT
    NULL,
    'diet_preferences',
    'special_diet',
    'Any special diet style? (optional)',
    'Leave as None unless you follow keto, intermittent fasting, or pescatarian (fish).',
    'select',
    '["None","Keto","Intermittent Fasting","Pescatarian"]'::jsonb,
    false,
    16,
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM question_definitions
    WHERE form_name = 'diet_preferences' AND question_key = 'special_diet' AND outlet_id IS NULL
);

-- ── 4. Migrate existing intake answers ──
UPDATE questions_responses
SET answers_json = answers_json
    || jsonb_build_object('diet_type', 'Vegetarian', 'eats_eggs', true),
    updated_at = now()
WHERE form_name = 'diet_preferences'
  AND deleted_at IS NULL
  AND answers_json->>'diet_type' = 'Eggetarian';

UPDATE questions_responses
SET answers_json = (answers_json - 'diet_type')
    || jsonb_build_object('diet_type', 'Non-Vegetarian', 'special_diet', 'Pescatarian'),
    updated_at = now()
WHERE form_name = 'diet_preferences'
  AND deleted_at IS NULL
  AND answers_json->>'diet_type' = 'Pescatarian';

UPDATE questions_responses
SET answers_json = (answers_json - 'diet_type')
    || jsonb_build_object('diet_type', 'No Specific Diet', 'special_diet', 'Keto'),
    updated_at = now()
WHERE form_name = 'diet_preferences'
  AND deleted_at IS NULL
  AND answers_json->>'diet_type' = 'Keto';

UPDATE questions_responses
SET answers_json = (answers_json - 'diet_type')
    || jsonb_build_object('diet_type', 'No Specific Diet', 'special_diet', 'Intermittent Fasting'),
    updated_at = now()
WHERE form_name = 'diet_preferences'
  AND deleted_at IS NULL
  AND answers_json->>'diet_type' = 'Intermittent Fasting';

-- Vegetarian without eats_eggs key → default false (strict veg)
UPDATE questions_responses
SET answers_json = answers_json || jsonb_build_object('eats_eggs', false),
    updated_at = now()
WHERE form_name = 'diet_preferences'
  AND deleted_at IS NULL
  AND answers_json->>'diet_type' = 'Vegetarian'
  AND NOT (answers_json ? 'eats_eggs');

-- ── 5. Clone week 1 → weeks 2..duration_weeks (fixes "No items listed for this day") ──
CREATE OR REPLACE FUNCTION public._fill_plan_template_weeks_from_first(p_template_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_duration   INT;
    v_source     plan_weeks%ROWTYPE;
    v_new_week   UUID;
    v_src_day    plan_days%ROWTYPE;
    v_new_day    UUID;
    v_week_num   INT;
    v_tgt        plan_daily_targets%ROWTYPE;
BEGIN
    SELECT duration_weeks INTO v_duration
    FROM plan_templates WHERE id = p_template_id;

    IF v_duration IS NULL OR v_duration <= 1 THEN RETURN; END IF;

    SELECT * INTO v_source
    FROM plan_weeks
    WHERE plan_template_id = p_template_id AND week_number = 1
    LIMIT 1;

    IF v_source.id IS NULL THEN RETURN; END IF;

    FOR v_week_num IN 2..v_duration LOOP
        IF EXISTS (
            SELECT 1 FROM plan_weeks
            WHERE plan_template_id = p_template_id AND week_number = v_week_num
        ) THEN
            CONTINUE;
        END IF;

        INSERT INTO plan_weeks (plan_template_id, week_number, title, overview, display_order)
        VALUES (
            p_template_id,
            v_week_num,
            replace(COALESCE(v_source.title, 'Week 1'), 'Week 1', 'Week ' || v_week_num),
            v_source.overview,
            v_week_num
        )
        RETURNING id INTO v_new_week;

        FOR v_src_day IN
            SELECT * FROM plan_days WHERE plan_week_id = v_source.id ORDER BY day_number
        LOOP
            INSERT INTO plan_days (plan_week_id, day_number, day_label, is_rest_day, overview, display_order)
            VALUES (
                v_new_week,
                v_src_day.day_number,
                v_src_day.day_label,
                v_src_day.is_rest_day,
                v_src_day.overview,
                v_src_day.display_order
            )
            RETURNING id INTO v_new_day;

            SELECT * INTO v_tgt FROM plan_daily_targets WHERE plan_day_id = v_src_day.id LIMIT 1;
            IF v_tgt.id IS NOT NULL THEN
                INSERT INTO plan_daily_targets (
                    plan_day_id, target_calories, target_protein_g, target_carbs_g,
                    target_fat_g, target_water_ml, target_steps
                ) VALUES (
                    v_new_day,
                    v_tgt.target_calories, v_tgt.target_protein_g, v_tgt.target_carbs_g,
                    v_tgt.target_fat_g, v_tgt.target_water_ml, v_tgt.target_steps
                );
            END IF;

            INSERT INTO meal_items (
                plan_day_id, display_order, meal_name, meal_time, meal_type,
                foods, calories, protein_g, carbs_g, fat_g, preparation_note
            )
            SELECT
                v_new_day, display_order, meal_name, meal_time, meal_type,
                foods, calories, protein_g, carbs_g, fat_g, preparation_note
            FROM meal_items WHERE plan_day_id = v_src_day.id;

            INSERT INTO exercise_items (
                plan_day_id, display_order, exercise_name, muscle_group, equipment,
                category, sets, reps, duration_seconds, rest_seconds, instructions, tips
            )
            SELECT
                v_new_day, display_order, exercise_name, muscle_group, equipment,
                category, sets, reps, duration_seconds, rest_seconds, instructions, tips
            FROM exercise_items WHERE plan_day_id = v_src_day.id;
        END LOOP;
    END LOOP;
END;
$$;

-- All eggetarian + any template missing weeks for its duration
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT pt.id
        FROM plan_templates pt
        WHERE pt.deleted_at IS NULL
          AND pt.duration_weeks > 1
          AND (
              'eggetarian' = ANY (COALESCE(pt.tags, '{}'))
              OR (
                  SELECT COUNT(*) FROM plan_weeks pw WHERE pw.plan_template_id = pt.id
              ) < pt.duration_weeks
          )
    LOOP
        PERFORM public._fill_plan_template_weeks_from_first(r.id);
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public._fill_plan_template_weeks_from_first IS
    'Clone week 1 days/meals/exercises to weeks 2..duration_weeks — reuse when seeding partial templates.';

COMMENT ON COLUMN question_definitions.visibility_json IS
    'Audience rules. Example: {"show_when":{"question_key":"diet_type","values":["Vegetarian"]}} for eats_eggs.';
