import { GymDashboardHome } from "@/components/admin/GymDashboardHome";
import { ROUTES } from "@/utils/routes";

export default function AdminHomePage() {
  return (
    <GymDashboardHome
      branchesManageHref={ROUTES.adminOrganization}
      customersHref={ROUTES.adminCustomers}
      staffHref={`${ROUTES.admin}/staff`}
    />
  );
}
