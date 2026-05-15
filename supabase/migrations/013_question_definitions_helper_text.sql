-- Patch: align existing `question_definitions` with app + `012_onboarding_questionnaire.sql`.
-- Fixes PostgREST: "column question_definitions.helper_text does not exist"
ALTER TABLE question_definitions
    ADD COLUMN IF NOT EXISTS helper_text TEXT;
