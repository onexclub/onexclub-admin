-- =============================================================================
-- Fix: invalid input value for enum user_role: "gym_admin"
-- =============================================================================
-- Symptom: `/dashboard/staff` shows "Unable to read roster" and PostgREST
-- returns the enum error — often `staff_assignments.role` still holds the
-- legacy label `gym_admin` from an older Gym SaaS draft, while `user_role`
-- on this project only defines `gym_owner`, `branch_admin`, etc.
--
-- This file is safe on fresh DBs (adds an unused enum label, 0-row updates).
--
-- Reuse: any feature selecting `user_role` columns can hit the same error if
-- legacy data or scripts still say `gym_admin`; extend the UPDATE list below
-- if you add more tables using `user_role`.
--
-- Requires PostgreSQL 15+ (Supabase hosted: yes) for ADD VALUE IF NOT EXISTS.
-- On older Postgres, run the enum add from the SQL Editor outside a transaction
-- or use a `DO` block that checks `pg_enum` before `ALTER TYPE ... ADD VALUE`.
-- =============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'gym_admin';

-- Canonical owner label in this repo (`001_gym_saas_core_admin_console.sql`).
UPDATE public.staff_assignments
SET role = 'gym_owner'
WHERE role::text = 'gym_admin';

-- Defensive: memberships should be `customer`; `gym_admin` here would be bad data.
UPDATE public.gym_memberships
SET role = 'customer'
WHERE role::text = 'gym_admin';
