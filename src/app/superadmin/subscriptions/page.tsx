import { EmptyState } from "@/components/ui/EmptyState";

/** Stub — hidden from superadmin nav until platform billing is needed. Re-add to `layout.tsx` NAV when ready. */
export default function SuperadminSubscriptionsPage() {
  return (
    <EmptyState
      title="Subscriptions"
      description="Wire Stripe (or your billing provider) here. Keep all billing secrets on the server and store subscription state in Supabase with strict RLS."
    />
  );
}
