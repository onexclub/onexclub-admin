-- Show eats_eggs directly after diet_type in intake forms.
UPDATE question_definitions
SET display_order = 2, updated_at = now()
WHERE form_name = 'diet_preferences'
  AND question_key = 'eats_eggs'
  AND outlet_id IS NULL
  AND deleted_at IS NULL;

UPDATE question_definitions
SET display_order = display_order + 1, updated_at = now()
WHERE form_name = 'diet_preferences'
  AND outlet_id IS NULL
  AND question_key NOT IN ('diet_type', 'eats_eggs')
  AND display_order >= 2
  AND deleted_at IS NULL;
