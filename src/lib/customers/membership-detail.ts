import type { MembershipAuditDisplay } from "@/lib/customers/membership-audit";
import type { ProfileVitalsSnapshot } from "@/lib/profile/vitals";

/** Row shape shared with customer roster + profile workspace. */
export type CustomerMembershipDetailMembership = {
  id: string;
  status: string;
  outlet_id: string;
  profile_id: string;
  assigned_trainer_id: string | null;
  joined_at: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_paid: number | null;
  currency: string | null;
  profile: ({ full_name: string | null; email: string | null; phone: string | null } & ProfileVitalsSnapshot) | null;
  outlet: { name: string | null; city: string | null } | null;
  plan: { id: string; name: string } | null;
  audit: MembershipAuditDisplay;
};

export type TrainerLite = { id: string; full_name: string | null; email: string | null };
