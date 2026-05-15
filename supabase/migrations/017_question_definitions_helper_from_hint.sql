-- =============================================================================
-- Question copy: some exports / admin UIs store subtitle text in `hint` while
-- migration 012 + the admin app expect `helper_text`. String-array `options_json`
-- is handled in the app (`normalizeOptions` in `question-definitions.service.ts`).
--
-- Idempotent: no-op when `hint` is absent.
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'question_definitions'
          AND column_name = 'hint'
    ) THEN
        UPDATE public.question_definitions
        SET helper_text = COALESCE(helper_text, hint)
        WHERE hint IS NOT NULL
          AND COALESCE(btrim(helper_text::text), '') = '';
    END IF;
END;
$$;
