import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminPaymentsPlaceholderPage() {
  return (
    <EmptyState
      title="Payments"
      description="Keep payment provider secrets on the server. Store ledger rows per outlet with RLS mirroring `gym_memberships` access rules."
    />
  );
}
