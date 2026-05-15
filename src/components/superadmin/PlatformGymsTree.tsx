import Link from "next/link";
import { ROUTES } from "@/utils/routes";
import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";
import {
  branchesForOrg,
  formatPlanTierLabel,
  type PlatformBranchRow,
  type PlatformOrgRow,
} from "@/lib/superadmin/platform-gyms-data";

type Props = {
  orgs: PlatformOrgRow[];
  branches: PlatformBranchRow[];
  memberCountByOutletId: Map<string, number>;
};

function badgeActive(isActive: boolean) {
  return (
    <span
      className={
        isActive
          ? "rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      }
    >
      {isActive ? "active" : "inactive"}
    </span>
  );
}

/**
 * Platform dashboard: organizations → gym branches (DB: `outlets`).
 * Data from `loadPlatformOrgsAndBranches` in `@/lib/superadmin/platform-gyms-data`.
 * Logos reuse `GymLogoThumbnail` (same as `/superadmin/gyms`).
 */
export function PlatformGymsTree({ orgs, branches, memberCountByOutletId }: Props) {
  if (!orgs.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-4 font-mono text-zinc-500 dark:text-zinc-400">│</div>
      <div className="mb-3 font-mono text-zinc-800 dark:text-zinc-200">
        <span className="text-zinc-500 dark:text-zinc-400">├──</span>{" "}
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Organizations</span>{" "}
        <span className="text-zinc-500 dark:text-zinc-400">(all gyms onboarded)</span>
      </div>

      <ul className="space-y-4 border-l border-zinc-300 pl-4 dark:border-zinc-600">
        {orgs.map((org) => {
          const orgBranches = branchesForOrg(org.id, branches);
          return (
            <li key={org.id} className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="absolute -left-4 top-2 h-px w-3 bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                <Link
                  href={`${ROUTES.superadminGyms}/${org.id}`}
                  className="inline-flex shrink-0 items-center"
                  title={`Open ${org.name}`}
                >
                  <GymLogoThumbnail logoUrl={org.logo_url} name={org.name} size="sm" />
                </Link>
                <Link
                  href={`${ROUTES.superadminGyms}/${org.id}`}
                  className="font-semibold text-orange-800 underline decoration-orange-600/30 underline-offset-2 hover:decoration-orange-600 dark:text-orange-300 dark:decoration-orange-400/30 dark:hover:decoration-orange-400"
                >
                  {org.name}
                </Link>
                {badgeActive(org.is_active)}
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                  {formatPlanTierLabel(org.plan_tier)}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  [{orgBranches.length} {orgBranches.length === 1 ? "branch" : "branches"}]
                </span>
              </div>

              {orgBranches.length > 0 ? (
                <ul className="mt-2 space-y-2 border-l border-zinc-200 pl-4 dark:border-zinc-700">
                  {orgBranches.map((b) => {
                    const members = memberCountByOutletId.get(b.id) ?? 0;
                    const locBits = [b.city, b.state, b.country].filter(Boolean).join(", ");
                    const label = locBits.length ? `${b.name} · ${locBits}` : b.name;
                    return (
                      <li key={b.id} className="relative">
                        <span className="absolute -left-4 top-2.5 h-px w-3 bg-zinc-200 dark:bg-zinc-700" aria-hidden />
                        <Link
                          href={`${ROUTES.superadminGyms}/${org.id}#branch-${b.id}`}
                          className="text-zinc-800 hover:underline dark:text-zinc-100"
                        >
                          {label}
                        </Link>{" "}
                        {badgeActive(b.is_active)}{" "}
                        <span className="text-zinc-500 dark:text-zinc-400">
                          [{members} {members === 1 ? "member" : "members"}]
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 pl-1 text-xs text-zinc-500 dark:text-zinc-400">No branches yet — add one from All gyms.</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 font-mono text-zinc-500 dark:text-zinc-400">│</div>
    </div>
  );
}
