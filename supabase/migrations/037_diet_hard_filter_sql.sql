-- Diet preference as HARD filter in SQL picker (auto-assign on intake).
-- Prevents Non-Vegetarian members receiving Vegan/Vegetarian templates when
-- a wrong template would otherwise win on score/age tiebreakers.

CREATE OR REPLACE FUNCTION public.template_matches_diet_tag(
    p_plan_type TEXT,
    p_diet_tag TEXT,
    p_tags TEXT[],
    p_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_name TEXT := lower(COALESCE(p_name, ''));
    v_has_non_veg BOOLEAN;
    v_has_veg BOOLEAN;
    v_has_vegan BOOLEAN;
BEGIN
    IF p_plan_type <> 'diet' OR p_diet_tag IS NULL THEN
        RETURN TRUE;
    END IF;

    v_has_non_veg := 'non_vegetarian' = ANY (COALESCE(p_tags, '{}'))
        OR (v_name ~ 'non[\s-]*veget');
    v_has_veg := 'vegetarian' = ANY (COALESCE(p_tags, '{}'))
        OR (v_name LIKE '%vegetarian%' AND v_name !~ 'non[\s-]*veget');
    v_has_vegan := 'vegan' = ANY (COALESCE(p_tags, '{}'))
        OR v_name LIKE '%vegan%';

    RETURN CASE p_diet_tag
        WHEN 'non_vegetarian' THEN v_has_non_veg AND NOT v_has_vegan AND NOT v_has_veg
        WHEN 'vegetarian'     THEN v_has_veg AND NOT v_has_non_veg AND NOT v_has_vegan
        WHEN 'vegan'          THEN v_has_vegan AND NOT v_has_non_veg AND NOT v_has_veg
        WHEN 'eggetarian'     THEN 'eggetarian' = ANY (COALESCE(p_tags, '{}')) OR v_name LIKE '%eggetarian%'
        WHEN 'pescatarian'    THEN 'pescatarian' = ANY (COALESCE(p_tags, '{}')) OR v_name LIKE '%pescatarian%'
        WHEN 'keto'           THEN 'keto' = ANY (COALESCE(p_tags, '{}')) OR v_name LIKE '%keto%'
        WHEN 'intermittent_fasting' THEN 'intermittent_fasting' = ANY (COALESCE(p_tags, '{}'))
        ELSE TRUE
    END;
END;
$$;

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
           AND public.template_matches_diet_tag(
                p_plan_type, v_diet_tag, pt.tags, pt.name
           )
         ORDER BY
           CASE WHEN pt.outlet_id IS NOT NULL THEN 0 ELSE 1 END,
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

    PERFORM public.log_template_gap(
        p_plan_type,
        COALESCE(v_norm_goal, 'general_fitness'),
        p_tier,
        COALESCE(p_gender, 'any'),
        CASE WHEN v_diet_tag IS NOT NULL THEN ARRAY[v_diet_tag] ELSE '{}'::TEXT[] END
    );

    RETURN v_plan;
END;
$$;
