-- profiles.created_by — who first provisioned the row (staff phone onboard).
-- Self-signup rows from handle_new_user stay NULL; staff sets it on first service-role patch.
-- See auditActorOnFirstProfileProvision in src/lib/supabase/audit-columns.ts.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.created_by IS
  'Staff profile id that first provisioned this member (dashboard onboard). NULL for auth-trigger-only signups.';
