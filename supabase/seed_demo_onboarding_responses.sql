-- =============================================================================
-- Demo data: populate sample `questions_responses` for QA / UI previews
-- =============================================================================
-- Run in Supabase SQL Editor (postgres role or service role). Safe to run multiple
-- times — uses ON CONFLICT to upsert.
--
-- What it does:
-- 1. Picks the newest non-deleted `gym_memberships` row in the DB.
-- 2. Seeds three sections (basic_info, health_screening, diet_preferences).
--    Keys match seeded `question_definitions` in migration 012.
--
-- To target ONE membership explicitly, replace the `target` CTE with:
--   SELECT '<profile_uuid>'::uuid AS profile_id, '<outlet_uuid>'::uuid AS outlet_id;
-- =============================================================================

WITH target AS (
    SELECT gm.profile_id, gm.outlet_id
    FROM gym_memberships gm
    WHERE gm.deleted_at IS NULL
    ORDER BY gm.joined_at DESC NULLS LAST
    LIMIT 1
),
editor AS (
    SELECT COALESCE(
        (SELECT sa.profile_id FROM staff_assignments sa WHERE sa.revoked_at IS NULL ORDER BY sa.assigned_at ASC LIMIT 1),
        (SELECT t.profile_id FROM target t LIMIT 1)
    ) AS id
)
INSERT INTO questions_responses (
    profile_id,
    outlet_id,
    form_name,
    answers_json,
    answered_by,
    last_edited_by,
    is_complete,
    completed_at
)
SELECT
    t.profile_id,
    t.outlet_id,
    seed.form_name,
    seed.answers_json,
    e.id,
    e.id,
    seed.is_complete,
    CASE WHEN seed.is_complete THEN now() ELSE NULL END
FROM target t
CROSS JOIN editor e
CROSS JOIN (VALUES
    (
        'basic_info',
        '{
          "emergency_contact_name":"Jordan Kumar",
          "emergency_contact_phone":"+91 98765 43210",
          "fitness_goal":"muscle_gain",
          "activity_level":"moderate"
        }'::jsonb,
        false
    ),
    (
        'health_screening',
        '{
          "parq_acknowledged":true,
          "heart_condition":false,
          "chest_pain_when_active":false,
          "medications_notes":"Vitamin D occasionally; no prescriptions."
        }'::jsonb,
        false
    ),
    (
        'diet_preferences',
        '{
          "diet_pattern":["high_protein","no_restrictions"],
          "food_allergies":["peanuts","shellfish"],
          "hydration_liters":2.5,
          "sweet_tooth_scale":7
        }'::jsonb,
        true
    )
) AS seed(form_name, answers_json, is_complete)
WHERE EXISTS (SELECT 1 FROM target)
ON CONFLICT (profile_id, outlet_id, form_name)
DO UPDATE SET
    answers_json = EXCLUDED.answers_json,
    answered_by = EXCLUDED.answered_by,
    last_edited_by = EXCLUDED.last_edited_by,
    is_complete = EXCLUDED.is_complete,
    completed_at = EXCLUDED.completed_at,
    updated_at = now();
