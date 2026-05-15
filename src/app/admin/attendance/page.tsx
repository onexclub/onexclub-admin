import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminAttendancePlaceholderPage() {
  return (
    <EmptyState
      title="Attendance"
      description="Connect check-in hardware or manual desk mode using the `check_ins` table. Staff already have a lightweight check-in example under `/staff/members`."
    />
  );
}
