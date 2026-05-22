import { redirect } from "next/navigation";
import { dashboardCustomerMembershipPath } from "@/utils/routes";

/** Legacy route — intake forms live on the main profile workspace (`?section=` tabs). */
export default async function DashboardCustomerOnboardingRedirect({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  redirect(`${dashboardCustomerMembershipPath(membershipId)}?section=basic-info`);
}
