import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export type RosterStatusDisplay = {
  label: string;
  variant: BadgeVariant;
};

/** Maps membership row to roster pill: active / expiring / expired / pending (+ legacy statuses). */
export function rosterStatusDisplay(status: string, endDate: string | null | undefined): RosterStatusDisplay {
  const normalized = status.toLowerCase();

  if (normalized === "pending") {
    return { label: "Pending", variant: "default" };
  }
  if (normalized === "expired") {
    return { label: "Expired", variant: "danger" };
  }
  if (normalized === "suspended") {
    return { label: "Suspended", variant: "danger" };
  }
  if (normalized === "inactive") {
    return { label: "Inactive", variant: "default" };
  }

  if (normalized === "active" && endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const today = new Date();
    const end = new Date(`${endDate}T12:00:00.000Z`);
    const msPerDay = 86_400_000;
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / msPerDay);
    if (daysLeft >= 0 && daysLeft <= 7) {
      return { label: "Expiring", variant: "warning" };
    }
    if (daysLeft < 0) {
      return { label: "Expired", variant: "danger" };
    }
  }

  if (normalized === "active") {
    return { label: "Active", variant: "success" };
  }

  return { label: status, variant: "default" };
}
