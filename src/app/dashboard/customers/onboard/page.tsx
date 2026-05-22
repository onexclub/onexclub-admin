import { redirect } from "next/navigation";
import { ROUTES } from "@/utils/routes";

/** Legacy `/dashboard/customers/onboard` → canonical wizard at `/dashboard/customers/new`. */
export default function DashboardCustomerOnboardRedirectPage() {
  redirect(ROUTES.dashboardCustomerNew);
}
