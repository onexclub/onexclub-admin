import { GymDashboardHome } from "@/components/admin/GymDashboardHome";
import { ROUTES } from "@/utils/routes";

/** `/dashboard` home — branch-aware reports & analytics. */

export default function DashboardHomePage() {
  return (
    <GymDashboardHome
      branchesManageHref={ROUTES.dashboardBranches}
      customersHref={ROUTES.dashboardCustomers}
      staffHref={ROUTES.dashboardStaff}
    />
  );
}
