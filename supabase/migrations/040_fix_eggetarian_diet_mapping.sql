-- Production fix: Eggetarian was mapped to vegetarian (031) — caused wrong diet plans.
-- Also fix Pescatarian mapping; disable SQL auto-assign (app tier uses AI-aware matching).

CREATE OR REPLACE FUNCTION public.map_diet_type_tag(p_label TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE TRIM(COALESCE(p_label, ''))
        WHEN 'Vegetarian'           THEN 'vegetarian'
        WHEN 'Non-Vegetarian'       THEN 'non_vegetarian'
        WHEN 'Vegan'                THEN 'vegan'
        WHEN 'Eggetarian'           THEN 'eggetarian'
        WHEN 'Pescatarian'          THEN 'pescatarian'
        WHEN 'Keto'                 THEN 'keto'
        WHEN 'Intermittent Fasting' THEN 'intermittent_fasting'
        WHEN 'No Specific Diet'     THEN NULL
        ELSE NULL
    END;
$$;

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
    v_has_egg BOOLEAN;
BEGIN
    IF p_plan_type <> 'diet' OR p_diet_tag IS NULL THEN
        RETURN TRUE;
    END IF;

    v_has_non_veg := 'non_vegetarian' = ANY (COALESCE(p_tags, '{}'))
        OR (v_name ~ 'non[\s-]*veget');
    v_has_veg := 'vegetarian' = ANY (COALESCE(p_tags, '{}'))
        OR (v_name LIKE '%vegetarian%' AND v_name !~ 'non[\s-]*veget' AND v_name !~ 'egg');
    v_has_vegan := 'vegan' = ANY (COALESCE(p_tags, '{}'))
        OR v_name LIKE '%vegan%';
    v_has_egg := 'eggetarian' = ANY (COALESCE(p_tags, '{}'))
        OR v_name LIKE '%eggetarian%'
        OR v_name LIKE '%egg%';

    RETURN CASE p_diet_tag
        WHEN 'non_vegetarian' THEN v_has_non_veg AND NOT v_has_vegan AND NOT v_has_veg AND NOT v_has_egg
        WHEN 'vegetarian'     THEN v_has_veg AND NOT v_has_non_veg AND NOT v_has_vegan AND NOT v_has_egg
        WHEN 'vegan'          THEN v_has_vegan AND NOT v_has_non_veg AND NOT v_has_veg AND NOT v_has_egg
        WHEN 'eggetarian'     THEN v_has_egg AND NOT v_has_non_veg AND NOT v_has_vegan
        WHEN 'pescatarian'    THEN ('pescatarian' = ANY (COALESCE(p_tags, '{}')) OR v_name LIKE '%pescatarian%' OR v_name LIKE '%fish%')
                                AND NOT v_has_non_veg
        WHEN 'keto'           THEN 'keto' = ANY (COALESCE(p_tags, '{}')) OR v_name LIKE '%keto%'
        WHEN 'intermittent_fasting' THEN 'intermittent_fasting' = ANY (COALESCE(p_tags, '{}'))
        ELSE FALSE
    END;
END;
$$;

-- Stop SQL trigger from assigning wrong catalogue rows — app calls assignPlansWithMatching + AI.
CREATE OR REPLACE FUNCTION public.trigger_auto_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.is_complete IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.is_complete IS TRUE THEN
        RETURN NEW;
    END IF;

    IF public.intake_sections_complete(NEW.profile_id, NEW.outlet_id) THEN
        PERFORM public.compute_member_intake_score(NEW.profile_id, NEW.outlet_id);
    END IF;

    RETURN NEW;
END;
$$;
