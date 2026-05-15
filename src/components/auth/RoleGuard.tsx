import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DashboardFeature, UserRole } from "@/lib/auth/roles";
import { canWrite, hasAccess } from "@/lib/auth/roles";

type RoleGuardProps = {
  role: UserRole;
  feature: DashboardFeature;
  /**
   * Require write lane (mutations / invite tooling).
   * When false, read access is sufficient — optionally pair with {@link canWrite} in children for split UI.
   */
  requireWrite?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
};

/**
 * Server-rendered gate over `PERMISSIONS` (`src/lib/auth/roles.ts`).
 *
 * **Reuse:** prefer this over sprinkling literal role checks throughout components.
 */
export function RoleGuard({ role, feature, requireWrite = false, fallback, children }: RoleGuardProps) {
  const allowed = requireWrite ? canWrite(role, feature) : hasAccess(role, feature, "read");
  if (!allowed) {
    return (
      fallback ?? (
        <EmptyState
          title="You can’t open this section"
          description="Your role does not include the permissions required for this view. Ask a gym owner if you need access."
        />
      )
    );
  }
  return children;
}
