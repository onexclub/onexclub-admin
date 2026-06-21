-- Seed North India eggetarian diet catalogue (Punjab / Delhi / Himachal friendly).
-- **Reuse:** `_seed_eggetarian_north_india_diet()` for future goal/level/gender combos.

CREATE OR REPLACE FUNCTION public._seed_eggetarian_north_india_diet(
    p_goal TEXT,
    p_level TEXT,
    p_gender TEXT,          -- 'male' | 'female' | NULL (unisex)
    p_min_score INT DEFAULT 0,
    p_max_score INT DEFAULT 100,
    p_score_tag TEXT DEFAULT NULL,
    p_target_calories INT DEFAULT 2000
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_template_id UUID;
    v_week_id UUID;
    v_day_id UUID;
    v_gender_tag TEXT;
    v_name TEXT;
    v_tags TEXT[];
    v_day INT;
BEGIN
    v_gender_tag := COALESCE(p_gender, 'any');

    v_name := initcap(replace(p_goal, '_', ' ')) || ' Diet — Eggetarian';
    IF p_score_tag IS NOT NULL THEN
        v_name := v_name || ' (score ' || replace(replace(p_score_tag, 'score_', ''), '_', '–') || ')';
    END IF;

    v_tags := ARRAY[
        p_goal,
        p_level,
        v_gender_tag,
        '26-35',
        'normal',
        'eggetarian',
        'north_india'
    ];
    IF p_score_tag IS NOT NULL THEN
        v_tags := v_tags || p_score_tag;
    END IF;

    INSERT INTO plan_templates (
        outlet_id, plan_type, name, description,
        difficulty_level, duration_weeks, primary_goal, target_gender,
        min_score, max_score, tags, source, status, is_active
    ) VALUES (
        NULL,
        'diet',
        v_name,
        'North India eggetarian plan — eggs daily (anda bhurji / boiled eggs) with roti, dal, paneer. Punjab, Delhi NCR, Himachal friendly.',
        p_level,
        4,
        p_goal,
        p_gender,
        p_min_score,
        p_max_score,
        v_tags,
        'manual',
        'active',
        TRUE
    )
    RETURNING id INTO v_template_id;

    INSERT INTO plan_weeks (plan_template_id, week_number, title, overview, display_order)
    VALUES (
        v_template_id,
        1,
        'Week 1 — Eggetarian North India',
        'Daily eggs + familiar Punjabi/Delhi home meals for gym members.',
        1
    )
    RETURNING id INTO v_week_id;

    FOR v_day IN 1..7 LOOP
        INSERT INTO plan_days (plan_week_id, day_number, day_label, is_rest_day, overview, display_order)
        VALUES (
            v_week_id,
            v_day,
            'Day ' || v_day,
            FALSE,
            'Eggetarian day — anda in breakfast, protein from dal/paneer/eggs.',
            v_day
        )
        RETURNING id INTO v_day_id;

        INSERT INTO plan_daily_targets (
            plan_day_id, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_water_ml, target_steps
        ) VALUES (
            v_day_id,
            p_target_calories,
            CASE p_goal WHEN 'muscle_gain' THEN 130 WHEN 'weight_loss' THEN 100 ELSE 110 END,
            CASE p_goal WHEN 'weight_loss' THEN 180 ELSE 220 END,
            CASE p_goal WHEN 'muscle_gain' THEN 75 ELSE 60 END,
            2500,
            CASE p_goal WHEN 'weight_loss' THEN 9000 ELSE 8000 END
        );

        -- Breakfast — always includes eggs
        INSERT INTO meal_items (plan_day_id, display_order, meal_name, meal_time, meal_type, foods, calories, protein_g, carbs_g, fat_g, preparation_note)
        VALUES (
            v_day_id, 1, 'Breakfast', '08:00', 'breakfast',
            '[
              {"name":"Anda Bhurji","qty":"2 eggs","calories":180,"protein_g":14,"carbs_g":4,"fat_g":12},
              {"name":"Roti","qty":"2","calories":160,"protein_g":5,"carbs_g":30,"fat_g":2},
              {"name":"Dahi","qty":"1 katori","calories":60,"protein_g":4,"carbs_g":5,"fat_g":2}
            ]'::jsonb,
            400, 23, 39, 16,
            'Punjabi-style anda bhurji with phulka — staple Delhi/Punjab gym breakfast'
        );

        INSERT INTO meal_items (plan_day_id, display_order, meal_name, meal_time, meal_type, foods, calories, protein_g, carbs_g, fat_g, preparation_note)
        VALUES (
            v_day_id, 2, 'Lunch', '13:00', 'lunch',
            '[
              {"name":"Dal","qty":"1 bowl","calories":180,"protein_g":10,"carbs_g":28,"fat_g":3},
              {"name":"Roti","qty":"2","calories":160,"protein_g":5,"carbs_g":30,"fat_g":2},
              {"name":"Mix Veg Sabzi","qty":"1 bowl","calories":120,"protein_g":4,"carbs_g":14,"fat_g":5},
              {"name":"Salad","qty":"1 katori","calories":40,"protein_g":2,"carbs_g":8,"fat_g":0}
            ]'::jsonb,
            500, 21, 80, 10,
            'Simple dal-roti-sabzi — Himachal/Delhi home lunch'
        );

        -- Snack — boiled eggs alternate days feel; always egg for validation
        INSERT INTO meal_items (plan_day_id, display_order, meal_name, meal_time, meal_type, foods, calories, protein_g, carbs_g, fat_g, preparation_note)
        VALUES (
            v_day_id, 3, 'Evening Snack', '17:00', 'evening_snack',
            CASE WHEN v_day % 2 = 0 THEN
              '[
                {"name":"Boiled Eggs","qty":"2","calories":140,"protein_g":12,"carbs_g":1,"fat_g":10},
                {"name":"Fruit","qty":"1 apple","calories":80,"protein_g":0,"carbs_g":20,"fat_g":0}
              ]'::jsonb
            ELSE
              '[
                {"name":"Egg White Omelette","qty":"3 whites + 1 whole egg","calories":120,"protein_g":16,"carbs_g":2,"fat_g":5},
                {"name":"Sprouts Chaat","qty":"1 bowl","calories":100,"protein_g":8,"carbs_g":12,"fat_g":2}
              ]'::jsonb
            END,
            220, 14, 21, 10,
            'Light protein snack before evening workout'
        );

        INSERT INTO meal_items (plan_day_id, display_order, meal_name, meal_time, meal_type, foods, calories, protein_g, carbs_g, fat_g, preparation_note)
        VALUES (
            v_day_id, 4, 'Dinner', '20:00', 'dinner',
            '[
              {"name":"Paneer Bhurji","qty":"100g","calories":260,"protein_g":18,"carbs_g":6,"fat_g":18},
              {"name":"Brown Rice","qty":"1 katori","calories":170,"protein_g":4,"carbs_g":36,"fat_g":1},
              {"name":"Cucumber Raita","qty":"1 bowl","calories":80,"protein_g":4,"carbs_g":6,"fat_g":4}
            ]'::jsonb,
            510, 26, 48, 23,
            'Paneer bhurji with rice — North India dinner favourite'
        );
    END LOOP;

    RETURN v_template_id;
END;
$$;

-- High-traffic goal × level × gender combos (mirrors existing vegetarian catalogue coverage)
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'beginner', NULL, 0, 40, 'score_0_40', 2000);
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'beginner', 'female', 0, 40, 'score_0_40', 1900);
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'beginner', 'male', 0, 40, 'score_0_40', 2200);
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'intermediate', NULL, 20, 70, 'score_20_70', 2100);
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'intermediate', 'female', 20, 70, 'score_20_70', 2000);
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'advanced', 'female', 55, 100, 'score_55_100', 2200);

SELECT public._seed_eggetarian_north_india_diet('muscle_gain', 'beginner', 'male', 0, 40, 'score_0_40', 2600);
SELECT public._seed_eggetarian_north_india_diet('muscle_gain', 'beginner', 'female', 0, 40, 'score_0_40', 2300);
SELECT public._seed_eggetarian_north_india_diet('muscle_gain', 'intermediate', 'male', 20, 70, 'score_20_70', 2700);
SELECT public._seed_eggetarian_north_india_diet('muscle_gain', 'intermediate', 'female', 20, 70, 'score_20_70', 2400);

SELECT public._seed_eggetarian_north_india_diet('weight_loss', 'beginner', 'female', 0, 40, 'score_0_40', 1600);
SELECT public._seed_eggetarian_north_india_diet('weight_loss', 'beginner', 'male', 0, 40, 'score_0_40', 1800);
SELECT public._seed_eggetarian_north_india_diet('weight_loss', 'intermediate', 'female', 20, 70, 'score_20_70', 1700);
SELECT public._seed_eggetarian_north_india_diet('weight_loss', 'intermediate', NULL, 20, 70, 'score_20_70', 1750);

SELECT public._seed_eggetarian_north_india_diet('endurance', 'beginner', NULL, 0, 40, 'score_0_40', 2200);
SELECT public._seed_eggetarian_north_india_diet('endurance', 'intermediate', 'female', 20, 70, 'score_20_70', 2300);

SELECT public._seed_eggetarian_north_india_diet('flexibility', 'beginner', NULL, 0, 40, 'score_0_40', 1900);
SELECT public._seed_eggetarian_north_india_diet('flexibility', 'intermediate', 'female', 20, 70, 'score_20_70', 2000);

COMMENT ON FUNCTION public._seed_eggetarian_north_india_diet IS
    'Internal seed helper — inserts one active eggetarian diet template with North India egg meals. Reuse for catalogue expansion.';
