-- Patch: `validation_json` for number/scale bounds (see `012_onboarding_questionnaire.sql`).
-- Fixes PostgREST: "column question_definitions.validation_json does not exist"
ALTER TABLE question_definitions
    ADD COLUMN IF NOT EXISTS validation_json JSONB;
