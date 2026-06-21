-- Catalogue gaps: eggetarian + male + intermediate for flexibility & general_fitness.

SELECT public._seed_eggetarian_north_india_diet('flexibility', 'intermediate', 'male', 20, 70, 'score_20_70', 2000);
SELECT public._seed_eggetarian_north_india_diet('general_fitness', 'intermediate', 'male', 20, 70, 'score_20_70', 2100);
SELECT public._seed_eggetarian_north_india_diet('flexibility', 'intermediate', NULL, 20, 70, 'score_20_70', 2000);

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT pt.id FROM plan_templates pt
        WHERE pt.name LIKE '%Eggetarian%'
          AND pt.created_at > now() - interval '5 minutes'
    LOOP
        PERFORM public._fill_plan_template_weeks_from_first(r.id);
    END LOOP;
END;
$$;
