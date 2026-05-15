import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setOrganizationActiveAction } from "@/app/superadmin/gyms/actions";
import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/utils/routes";
import { loadOrganizationGymOwners } from "@/lib/superadmin/gym-owners";
import {
  branchesForOrg,
  formatPlanTierLabel,
  loadPlatformOrgsAndBranches,
} from "@/lib/superadmin/platform-gyms-data";

function regionLabel(branch: {
  city: string | null;
  state: string | null;
  country: string | null;
}): string {
  const bits = [branch.city ?? "", branch.state ?? "", branch.country ?? ""].filter(Boolean);
  return bits.length ? bits.join(", ") : "—";
}

export default async function SuperadminGymOrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createServerSupabaseClient();
  const { orgs, branches, memberCountByOutletId } = await loadPlatformOrgsAndBranches(supabase);
  const org = orgs.find((o) => o.id === orgId);

  if (!org) {
    return (
      <EmptyState
        title="Organization not found"
        description="This organization does not exist or was removed."
        action={
          <Link
            href={ROUTES.superadminGyms}
            className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Back to all gyms
          </Link>
        }
      />
    );
  }

  const orgBranches = branchesForOrg(org.id, branches);
  const gymOwners = await loadOrganizationGymOwners(supabase, org.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <GymLogoThumbnail logoUrl={org.logo_url} name={org.name} size="hero" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{org.name}</h2>
              <span
                className={
                  org.is_active
                    ? "rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
                    : "rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                }
              >
                {org.is_active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                {formatPlanTierLabel(org.plan_tier)}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Slug <span className="font-mono text-zinc-800 dark:text-zinc-200">{org.slug}</span> ·{" "}
              {orgBranches.length} {orgBranches.length === 1 ? "branch" : "branches"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`${ROUTES.superadminGyms}/${org.id}/edit`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Edit gym
          </Link>
          <Link
            href={`${ROUTES.superadminGyms}/${org.id}/branches/new`}
            className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Add branch
          </Link>
          <form action={setOrganizationActiveAction}>
            <input type="hidden" name="id" value={org.id} />
            <input type="hidden" name="is_active" value={org.is_active ? "false" : "true"} />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {org.is_active ? "Deactivate org" : "Activate org"}
            </button>
          </form>
          <Link
            href={ROUTES.superadminGyms}
            className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
          >
            All gyms
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Gym owner</h3>
          <Link
            href={`${ROUTES.superadminGyms}/${org.id}/edit`}
            className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
          >
            Manage owner
          </Link>
        </div>
        {gymOwners.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No owner assigned yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {gymOwners.map((o) => (
              <li key={o.profile_id} className="text-sm text-zinc-700 dark:text-zinc-200">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{o.full_name ?? o.email}</span>
                <span className="text-zinc-500"> · {o.email}</span>
                <span className="block text-xs text-zinc-500">Branches: {o.branch_names.join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {orgBranches.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description="Add the first gym branch for this organization."
          action={
            <Link
              href={`${ROUTES.superadminGyms}/${org.id}/branches/new`}
              className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Add branch
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Active members</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {orgBranches.map((b) => (
                <tr key={b.id} id={`branch-${b.id}`} className="scroll-mt-24">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{b.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{regionLabel(b)}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-600 dark:text-zinc-300" title={b.address ?? ""}>
                    {b.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{b.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {memberCountByOutletId.get(b.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        b.is_active
                          ? "rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
                          : "rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${ROUTES.superadminGyms}/${org.id}/branches/${b.id}/edit`}
                      className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
