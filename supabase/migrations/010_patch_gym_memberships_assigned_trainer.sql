-- =============================================================================
-- PATCH: ensure gym_memberships.assigned_trainer_id + staff_assignments.invite_pending
--
-- Run this if you see: "column gym_memberships.assigned_trainer_id does not exist"
-- (common when `008_dashboard_diet_exercise_staff_rls.sql` failed partway — e.g.
-- `diet_plans` already existed — and the whole transaction rolled back, skipping
-- the ALTER at the top of that file).
--
-- Safe to run multiple times (IF NOT EXISTS).
-- =============================================================================

ALTER TABLE public.gym_memberships
    ADD COLUMN IF NOT EXISTS assigned_trainer_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_memberships_assigned_trainer
    ON public.gym_memberships(assigned_trainer_id)
    WHERE deleted_at IS NULL AND assigned_trainer_id IS NOT NULL;

ALTER TABLE public.staff_assignments
    ADD COLUMN IF NOT EXISTS invite_pending BOOLEAN NOT NULL DEFAULT false;
