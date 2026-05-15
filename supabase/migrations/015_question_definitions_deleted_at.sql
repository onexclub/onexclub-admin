-- Patch: soft-delete column used by merges + filtered selects (see `012_onboarding_questionnaire.sql`).
-- Fixes PostgREST: "column question_definitions.deleted_at does not exist"
ALTER TABLE question_definitions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
