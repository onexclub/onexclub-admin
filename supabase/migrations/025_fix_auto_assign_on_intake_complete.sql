-- Fix plan auto-assignment when intake questionnaires are saved during onboarding.
--
-- Root cause: the admin app upserts `questions_responses` with `is_complete = true` on INSERT
-- (see `src/features/onboarding/question-responses.service.ts`). The existing trigger only
-- fired AFTER UPDATE, so onboarding never called `assign_or_rotate_plans`.
--
-- Also gates assignment until all three app sections are complete:
--   basic_info, health_screening, diet_preferences
-- (see `src/features/onboarding/constants.ts`).

-- ── Helper: all intake sections finalized for member @ outlet ───────────────
CREATE OR REPLACE FUNCTION public.intake_sections_complete(
    p_profile_id UUID,
    p_outlet_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COUNT(DISTINCT form_name) = 3
    FROM questions_responses
    WHERE profile_id = p_profile_id
      AND outlet_id = p_outlet_id
      AND deleted_at IS NULL
      AND is_complete = TRUE
      AND form_name IN ('basic_info', 'health_screening', 'diet_preferences');
$$;

-- ── Trigger: assign diet + exercise templates once intake is fully complete ─
CREATE OR REPLACE FUNCTION public.trigger_auto_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.is_complete IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- UPDATE path: skip if already complete (avoid duplicate assignment attempts)
    IF TG_OP = 'UPDATE' AND OLD.is_complete IS TRUE THEN
        RETURN NEW;
    END IF;

    IF NOT public.intake_sections_complete(NEW.profile_id, NEW.outlet_id) THEN
        RETURN NEW;
    END IF;

    -- Skip when active assignments already exist (initial onboard only)
    IF EXISTS (
        SELECT 1
        FROM customer_plan_assignments
        WHERE profile_id = NEW.profile_id
          AND outlet_id = NEW.outlet_id
          AND status = 'active'
          AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    PERFORM public.assign_or_rotate_plans(
        NEW.profile_id,
        NEW.outlet_id,
        'basic_info',
        'initial',
        NULL
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_on_complete ON public.questions_responses;

CREATE TRIGGER auto_assign_on_complete
    AFTER INSERT OR UPDATE ON public.questions_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_assign();

-- ── Backfill: members with complete intake but no active plan assignments ─────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT qr.profile_id, qr.outlet_id
        FROM questions_responses qr
        WHERE qr.deleted_at IS NULL
          AND public.intake_sections_complete(qr.profile_id, qr.outlet_id)
          AND NOT EXISTS (
              SELECT 1
              FROM customer_plan_assignments cpa
              WHERE cpa.profile_id = qr.profile_id
                AND cpa.outlet_id = qr.outlet_id
                AND cpa.status = 'active'
                AND cpa.deleted_at IS NULL
          )
    LOOP
        PERFORM public.assign_or_rotate_plans(
            r.profile_id,
            r.outlet_id,
            'basic_info',
            'initial',
            NULL
        );
    END LOOP;
END;
$$;
