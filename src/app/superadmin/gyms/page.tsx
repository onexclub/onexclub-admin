import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setOrganizationActiveAction } from "@/app/superadmin/gyms/actions";
import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/utils/routes";

const PAGE_SIZE = 10;

/**
 * Listing is paginated (new gyms land on page 1 after onboarding redirect).
 * Logo column uses `@/components/superadmin/GymLogoThumbnail`.
 * Onboarding entry: primary button in the page header (sidebar does not duplicate `/superadmin/onboard`).
 */

export default async function SuperadminGymsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, parseInt(String(pageRaw ?? "1"), 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerSupabaseClient();
  const { data: orgs, count } = await supabase
    .from("organizations")
    .select("id,name,slug,is_active,created_at,contact_email,plan_tier,logo_url", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const orgRows = orgs ?? [];
  const orgIds = orgRows.map((o) => o.id);

  const { data: branchRows } =
    orgIds.length > 0
      ? await supabase.from("outlets").select("organization_id").in("organization_id", orgIds).is("deleted_at", null)
      : { data: [] as { organization_id: string }[] };

  const branchCountByOrgId = new Map<string, number>();
  for (const row of branchRows ?? []) {
    const orgId = String((row as { organization_id: string }).organization_id);
    branchCountByOrgId.set(orgId, (branchCountByOrgId.get(orgId) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">All gyms</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Each row is an organization. Open one to see branches, logos, and edit locations.
          </p>
        </div>
        {/* Reuse: superadmin sidebar has no "Onboard" item — this is the main entry to `/superadmin/onboard`. */}
        <Link
          href={ROUTES.superadminOnboard}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Onboard Gym
        </Link>
      </div>

      {!orgRows.length ? (
        <EmptyState
          title="No organizations yet"
          description="Superadmins create tenants here. Each organization can have many gym branches."
          action={
            <Link
              href={ROUTES.superadminOnboard}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Onboard Gym
            </Link>
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Logo</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Branches</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {orgRows.map((org) => (
                  <tr key={org.id}>
                    <td className="px-4 py-3 align-middle">
                      <Link href={`${ROUTES.superadminGyms}/${org.id}`} className="inline-block" title={org.name}>
                        <GymLogoThumbnail logoUrl={org.logo_url} name={org.name} size="sm" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      <Link
                        href={`${ROUTES.superadminGyms}/${org.id}`}
                        className="text-orange-800 hover:underline dark:text-orange-300"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{org.slug}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      <span className="capitalize">{String(org.plan_tier ?? "basic").replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{org.contact_email ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      <Link href={`${ROUTES.superadminGyms}/${org.id}`} className="hover:underline" title="View branches">
                        {branchCountByOrgId.get(org.id) ?? 0}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          org.is_active
                            ? "rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-950/50 dark:text-orange-200"
                            : "rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        }
                      >
                        {org.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${ROUTES.superadminGyms}/${org.id}/edit`}
                        className="mr-4 text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
                      >
                        Edit gym
                      </Link>
                      <Link
                        href={`${ROUTES.superadminGyms}/${org.id}/branches/new`}
                        className="mr-4 text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
                      >
                        Add branch
                      </Link>
                      <form action={setOrganizationActiveAction} className="inline">
                        <input type="hidden" name="id" value={org.id} />
                        <input type="hidden" name="is_active" value={org.is_active ? "false" : "true"} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
                        >
                          {org.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{page}</span> of{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages}</span>
              {" · "}
              {total} {total === 1 ? "organization" : "organizations"}
            </p>
            <div className="flex gap-2">
              <Link
                href={page <= 1 ? ROUTES.superadminGyms : `${ROUTES.superadminGyms}?page=${page - 1}`}
                className={`rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 ${
                  page <= 1 ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={page <= 1}
              >
                Previous
              </Link>
              <Link
                href={
                  page >= totalPages
                    ? `${ROUTES.superadminGyms}?page=${totalPages}`
                    : `${ROUTES.superadminGyms}?page=${page + 1}`
                }
                className={`rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 ${
                  page >= totalPages ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={page >= totalPages}
              >
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
