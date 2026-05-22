import { redirect } from "next/navigation";
import { dashboardCustomerMembershipPath } from "@/utils/routes";

/** Legacy admin path — redirects to dashboard profile workspace. */
export default async function AdminCustomerOnboardingRedirect({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  redirect(`${dashboardCustomerMembershipPath(membershipId)}?section=basic-info`);
}
