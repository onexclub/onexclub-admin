/**
 * Sidebar adapters built from centralized RBAC flags (`dashboardSidebarItems` in `src/lib/auth/roles.ts`).
 *
 * **Reuse:** keep route labels/hrefs centralized there so permission tweaks cascade to middleware + shell together.
 */

import type { SidebarNavPiece } from "@/lib/auth/roles";

export type DashboardSidebarNavItem = SidebarNavPiece;

/**
 * Transform permission fragments into `{ href,label,badge }` entries for {@link SidebarNav}.
 */
export function buildSidebarNavItemsFromPermissions(pieces: DashboardSidebarNavItem[]) {
  return pieces.map(({ href, label, badge }) => ({ href, label, badge }));
}
