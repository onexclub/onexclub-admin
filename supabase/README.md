# Supabase migrations

- `migrations/001_gym_saas_core_admin_console.sql` — **bootstrap** DDL + RLS for the tables this admin console touches on a fresh database.
- `migrations/002_storage_gym_brand_logos_bucket.sql` — public Storage bucket `gym-brand-logos` for `organizations.logo_url` (superadmin onboard upload). Bucket id is mirrored in `src/lib/supabase/gym-brand-logos-storage.ts`.
- `migrations/018_profile_avatars_bucket.sql` — public Storage bucket `profile-avatars` for staff/member headshots (`src/lib/supabase/profile-avatars-storage.ts`). Required for photo upload on `/dashboard/staff`.
- If you already maintain the full **Gym SaaS v1.0** schema elsewhere, keep that file as the source of truth and **avoid applying conflicting migrations** to the same project.

- `migrations/008_dashboard_diet_exercise_staff_rls.sql` — diet/exercise tables, `assigned_trainer_id`, roster RLS tweaks.
- **`migrations/010_patch_gym_memberships_assigned_trainer.sql`** — **run this** if PostgREST returns `column gym_memberships.assigned_trainer_id does not exist` (usually migration `008` never finished; this patch is idempotent).

Apply from the Supabase SQL editor or with the Supabase CLI:

```bash
supabase db push
```

### Quick fix: missing `assigned_trainer_id`

Paste and run **`010_patch_gym_memberships_assigned_trainer.sql`** alone in the SQL Editor, then retry the dashboard. Optionally re-run the rest of `008_*` afterward if diet/exercise tables/policies are still missing (resolve any “relation already exists” conflicts first).

### Quick fix: roster / `invalid input value for enum user_role: "gym_admin"`

Usually legacy `staff_assignments.role` rows still use **`gym_admin`** while this repo’s `user_role` enum only defines **`gym_owner`**. Paste and run **`011_legacy_user_role_gym_admin_normalize.sql`** in the SQL Editor (or `supabase db push`), then reload `/dashboard/staff`.

### Intake questionnaires: `question_definitions` + `questions_responses`

- **Definitions (what renders in the wizard):** `public.question_definitions` — `form_name` is one of `basic_info`, `health_screening`, `diet_preferences` (see `src/features/onboarding/constants.ts`). Platform-wide rows use `outlet_id IS NULL`; outlet-specific rows merge in app (`merge-question-definitions.ts`).
- **Subtitle / hint column:** Dashboard exports sometimes put copy in **`hint`** with **`helper_text` null**. The UI reads **`helper_text`** and falls back to **`hint`** in `question-definitions.service.ts`; run **`017_question_definitions_helper_from_hint.sql`** to persist `hint` → `helper_text`.
- **`options_json`:** Supported shapes are `[{"value":"x","label":"X"}, …]` **or** a plain JSON **string array** `["Under ₹3,000","₹6,000–₹10,000"]` — each string becomes both stored value and display label (answers in `answers_json` use that exact string).
- **Answers:** One row per member per outlet per section: `questions_responses` with `answers_json` as flat object keyed by **`question_key`**.

Examples (replace UUIDs):

```sql
-- All active definitions a branch sees (defaults + overrides)
SELECT *
FROM question_definitions
WHERE deleted_at IS NULL
  AND is_active = TRUE
  AND (outlet_id IS NULL OR outlet_id = '<outlet_uuid>')
  AND form_name = 'basic_info'
ORDER BY display_order;

-- Saved answers for that section
SELECT id, profile_id, outlet_id, form_name, answers_json, is_complete, updated_at
FROM questions_responses
WHERE deleted_at IS NULL
  AND profile_id = '<profile_uuid>'
  AND outlet_id = '<outlet_uuid>'
  AND form_name = 'basic_info';
```
