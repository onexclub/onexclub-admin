-- Gender-aware (and future) intake question visibility.
--
-- Moderator notes (Supabase dashboard → question_definitions.visibility_json):
--   NULL or {}                         → show to all members
--   {"genders":["female"]}             → female-only (e.g. pregnancy, menstrual cycle)
--   {"genders":["male"]}               → male-only prompts
--   {"genders":["male","female"]}      → binary only; hidden for other / prefer_not_to_say
--
-- App layer: `@/features/onboarding/question-visibility.ts` filters definitions before render,
-- validation, and payload export. Answers for hidden keys may remain in JSON for audit.

ALTER TABLE question_definitions
    ADD COLUMN IF NOT EXISTS visibility_json JSONB;

COMMENT ON COLUMN question_definitions.visibility_json IS
    'Optional audience rules. Example: {"genders":["female"]} limits a prompt to female members.';

-- Example: tag female-only intake prompts (adjust question_key values to match your Supabase rows):
-- UPDATE question_definitions
--    SET visibility_json = '{"genders":["female"]}'::jsonb
--  WHERE deleted_at IS NULL
--    AND question_key IN ('pregnancy_status', 'menstrual_cycle_regular', 'currently_pregnant');
