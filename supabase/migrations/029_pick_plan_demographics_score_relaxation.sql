-- Fix pick_plan_template relaxation order:
-- 1) Prefer matching gender before accepting wrong-gender templates when age is off.
-- 2) Relax score bounds on the final pass so goal-aligned templates aren't skipped
--    when intake score is 1 point below min_score (e.g. Athletic Performance → 9 vs min 10).

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
    v_strict    INTEGER;
BEGIN
    v_goals := public.intake_fitness_goal_fallbacks(p_fitness_goal_label);
    v_diet_tag := public.map_diet_type_tag(p_diet_type_label);

    -- strict 0: full demographic + score match
    -- strict 1: relax age band (keep gender preference)
    -- strict 2: relax gender requirement
    -- strict 3: relax score band (goal match already enforced above)
    FOREACH v_goal IN ARRAY v_goals LOOP
        FOR v_strict IN 0..3 LOOP
            SELECT pt.* INTO v_plan
              FROM plan_templates pt
             WHERE pt.plan_type = p_plan_type
               AND pt.is_active = TRUE
               AND pt.deleted_at IS NULL
               AND pt.difficulty_level = p_tier
               AND pt.primary_goal = v_goal
               AND (pt.outlet_id = p_outlet_id OR pt.outlet_id IS NULL)
               AND (p_exclude_template_id IS NULL OR pt.id <> p_exclude_template_id)
               AND (
                    p_plan_type <> 'diet'
                    OR v_diet_tag IS NULL
                    OR v_diet_tag = ANY (pt.tags)
                    -- Name fallback only when tags are missing; avoid "Non Vegetarian" ⊃ "Vegetarian"
                    OR (
                        v_diet_tag = 'vegetarian'
                        AND pt.name ILIKE '%vegetarian%'
                        AND pt.name NOT ILIKE '%non%veget%'
                    )
                    OR (
                        v_diet_tag = 'non_vegetarian'
                        AND (pt.name ILIKE '%non%veget%' OR 'non_vegetarian' = ANY (pt.tags))
                    )
                    OR (
                        v_diet_tag NOT IN ('vegetarian', 'non_vegetarian')
                        AND (
                            pt.name ILIKE ('%' || REPLACE(v_diet_tag, '_', ' ') || '%')
                            OR pt.name ILIKE ('%' || v_diet_tag || '%')
                        )
                    )
               )
               AND (
                    v_strict >= 2
                    OR pt.target_gender IS NULL
                    OR pt.target_gender = p_gender
               )
               AND (
                    v_strict >= 1
                    OR (
                        (pt.min_age IS NULL OR pt.min_age <= p_age)
                        AND (pt.max_age IS NULL OR pt.max_age >= p_age)
                    )
               )
               AND (pt.min_bmi IS NULL OR pt.min_bmi <= COALESCE(p_bmi, 22))
               AND (pt.max_bmi IS NULL OR pt.max_bmi >= COALESCE(p_bmi, 22))
               AND (
                    v_strict >= 3
                    OR (
                        (pt.min_score IS NULL OR pt.min_score <= COALESCE(p_score, 0))
                        AND (pt.max_score IS NULL OR pt.max_score >= COALESCE(p_score, 0))
                    )
               )
             ORDER BY
               CASE WHEN pt.outlet_id IS NOT NULL THEN 0 ELSE 1 END,
               CASE
                 WHEN pt.target_gender IS NOT NULL AND pt.target_gender = p_gender THEN 0
                 WHEN pt.target_gender IS NULL THEN 1
                 ELSE 2
               END,
               CASE
                 WHEN pt.min_age IS NOT NULL AND pt.max_age IS NOT NULL
                      AND p_age BETWEEN pt.min_age AND pt.max_age THEN 0
                 WHEN pt.min_age IS NULL AND pt.max_age IS NULL THEN 1
                 ELSE 2
               END,
               ABS(COALESCE(p_score, 15) - ((COALESCE(pt.min_score, 0) + COALESCE(pt.max_score, 30)) / 2.0))
             LIMIT 1;

            IF v_plan.id IS NOT NULL THEN
                RETURN v_plan;
            END IF;
        END LOOP;
    END LOOP;

    SELECT pt.* INTO v_plan
      FROM plan_templates pt
     WHERE pt.plan_type = p_plan_type
       AND pt.is_active = TRUE
       AND pt.deleted_at IS NULL
       AND pt.difficulty_level = p_tier
       AND (pt.outlet_id = p_outlet_id OR pt.outlet_id IS NULL)
       AND (p_exclude_template_id IS NULL OR pt.id <> p_exclude_template_id)
     ORDER BY CASE WHEN pt.outlet_id IS NOT NULL THEN 0 ELSE 1 END
     LIMIT 1;

    RETURN v_plan;
END;
$$;
