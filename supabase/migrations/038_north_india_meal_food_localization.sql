-- Localize western/global food names in diet catalogue → North India gym-friendly items.
-- Safe JSONB name remap on meal_items.foods arrays only.

CREATE OR REPLACE FUNCTION public.map_food_name_north_india(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE TRIM(COALESCE(p_name, ''))
        WHEN 'Toast' THEN 'Brown Bread'
        WHEN 'Whole Wheat Toast' THEN 'Brown Bread'
        WHEN 'Oatmeal' THEN 'Daliya'
        WHEN 'Oats' THEN 'Daliya'
        WHEN 'Quinoa' THEN 'Brown Rice'
        WHEN 'Greek Yogurt' THEN 'Dahi'
        WHEN 'Baked Salmon' THEN 'Fish Curry'
        WHEN 'Baked Cod' THEN 'Fish Curry'
        WHEN 'Grilled Fish' THEN 'Grilled Rohu Fish'
        WHEN 'Turkey Breast' THEN 'Grilled Chicken Breast'
        WHEN 'Turkey and Avocado Wrap' THEN 'Chicken Kathi Roll'
        WHEN 'Cauliflower Rice' THEN 'Steamed Gobhi Rice'
        WHEN 'Almond milk' THEN 'Low-Fat Milk'
        WHEN 'High-Fiber Cereal' THEN 'Daliya'
        WHEN 'Tofu Stir-fry' THEN 'Paneer Bhurji'
        WHEN 'Mixed Greens Salad' THEN 'Kachumber Salad'
        WHEN 'Steamed Asparagus' THEN 'Steamed Bhindi'
        WHEN 'Protein Shake' THEN 'Banana Lassi with Whey'
        ELSE TRIM(p_name)
    END;
$$;

UPDATE meal_items mi
   SET foods = sub.mapped
  FROM (
    SELECT
      mi2.id,
      COALESCE(
        jsonb_agg(
          jsonb_set(elem, '{name}', to_jsonb(public.map_food_name_north_india(elem->>'name')))
        ) FILTER (WHERE elem IS NOT NULL),
        '[]'::jsonb
      ) AS mapped
    FROM meal_items mi2
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(mi2.foods) = 'array' THEN mi2.foods ELSE '[]'::jsonb END
    ) AS elem
    GROUP BY mi2.id
  ) sub
 WHERE mi.id = sub.id
   AND mi.foods IS NOT NULL
   AND jsonb_typeof(mi.foods) = 'array';

COMMENT ON FUNCTION public.map_food_name_north_india IS
    'Remap western food labels to North India equivalents for diet catalogue consistency.';
