import { redirect } from "next/navigation";
import { ROUTES } from "@/utils/routes";

/** Legacy `/admin/members/onboard` → canonical wizard at `/dashboard/customers/new`. */
export default function AdminMemberOnboardRedirectPage() {
  redirect(ROUTES.dashboardCustomerNew);
}
