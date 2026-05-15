import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminStaffPage() {
  return (
    <EmptyState
      title="Manage staff"
      description="Next iteration: list `staff_assignments` for your outlets and invite receptionists or trainers (`receptionist` / `trainer` roles). Reuse the same service-role server action pattern as member onboarding, but insert into `staff_assignments` instead of `gym_memberships`."
    />
  );
}
