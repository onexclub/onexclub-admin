-- =============================================================================
-- Align `questions_responses` with `012_onboarding_questionnaire.sql` + the admin app.
--
-- Symptom: PostgREST error "column questions_responses.created_at does not exist"
-- Cause: databases created from older gym_saas drafts used `submitted_at` (and fewer
--        columns); the onboarding UI selects `created_at`, `updated_at`, and filters
--        on `deleted_at`.
--
-- Safe on fresh installs: every `ADD COLUMN IF NOT EXISTS` is a no-op when present.
-- =============================================================================

ALTER TABLE questions_responses
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS answered_by UUID REFERENCES profiles (id),
    ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles (id),
    ADD COLUMN IF NOT EXISTS is_complete BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Legacy drafts kept `submitted_at` instead of `created_at` — copy timestamps once.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'questions_responses'
          AND column_name = 'submitted_at'
    ) THEN
        UPDATE questions_responses
        SET
            created_at = COALESCE(created_at, submitted_at),
            updated_at = COALESCE(updated_at, submitted_at);
    END IF;
END;
$$;

UPDATE questions_responses
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE questions_responses
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE questions_responses
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET NOT NULL;

-- Keep `updated_at` in sync (same as 012).
CREATE OR REPLACE FUNCTION touch_questions_responses_updated_at ()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_questions_responses ON questions_responses;

CREATE TRIGGER trg_touch_questions_responses
    BEFORE UPDATE ON questions_responses
    FOR EACH ROW EXECUTE FUNCTION touch_questions_responses_updated_at();