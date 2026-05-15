import type { StaffAssignmentRole } from "@/types/roles";

/**
 * Narrow TypeScript shapes for tables we touch from the admin app.
 * For full codegen, use: `supabase gen types typescript --project-id <id>`.
 */
export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_superadmin: boolean;
  created_at: string;
};

export type StaffAssignmentRow = {
  id: string;
  profile_id: string;
  outlet_id: string;
  role: StaffAssignmentRole;
  revoked_at: string | null;
  invite_pending?: boolean | null;
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  /** JSON from migration: `{ street?, city?, state?, country?, zip? }`. */
  address_json?: Record<string, unknown> | null;
  /** Subscription / product tier (UI: shown on platform dashboard). */
  plan_tier?: string;
  is_active: boolean;
  contact_email: string | null;
  contact_phone?: string | null;
  created_at: string;
};

export type OutletRow = {
  id: string;
  organization_id: string;
  name: string;
  city: string | null;
  is_active: boolean;
};

export type GymMembershipRow = {
  id: string;
  profile_id: string;
  outlet_id: string;
  /** Links to outlet-scoped `membership_plans` when admins sell a templated tier (migration 004). */
  plan_id?: string | null;
  /** Optional dedicated coach for trainer-scoped modules + RLS helpers in migration 008. */
  assigned_trainer_id?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  amount_paid?: number | null;
  currency?: string | null;
};

export type BillingCycleDb = "monthly" | "quarterly" | "half_yearly" | "yearly";

export type MembershipPlanRow = {
  id: string;
  outlet_id: string;
  name: string;
  description?: string | null;
  price: number;
  currency?: string | null;
  billing_cycle?: BillingCycleDb | string;
  duration_days?: number | null;
  is_active?: boolean;
  display_order?: number;
};

/** Intake questionnaires: `question_definitions` + `questions_responses` (`012_onboarding_questionnaire.sql`). UI DTOs: `@/features/onboarding/types`. */
