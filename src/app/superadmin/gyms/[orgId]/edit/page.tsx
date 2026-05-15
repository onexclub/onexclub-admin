import Link from "next/link";
import { GymOwnerManagementPanel } from "@/components/superadmin/GymOwnerManagementPanel";
import { EditOrganizationForm } from "@/components/superadmin/EditOrganizationForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadOrganizationGymOwners } from "@/lib/superadmin/gym-owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROUTES } from "@/utils/routes";

export default async function SuperadminEditOrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createServerSupabaseClient();
  const owners = await loadOrganizationGymOwners(supabase, orgId);
  const { data: org } = await supabase
    .from("organizations")
    .select("id,name,slug,logo_url")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!org) {
    return (
      <EmptyState
        title="Organization not found"
        description="Open All gyms and pick a valid gym brand."
        action={
          <Link
            href={ROUTES.superadminGyms}
            className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            All gyms
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Edit gym (organization)</h2>
        <Link
          href={`${ROUTES.superadminGyms}/${org.id}`}
          className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
        >
          Back to branches
        </Link>
      </div>

      <EditOrganizationForm
        org={{
          id: String(org.id),
          name: org.name ?? "",
          slug: String(org.slug ?? ""),
          logo_url: org.logo_url ?? null,
        }}
      />

      <GymOwnerManagementPanel organizationId={String(org.id)} owners={owners} />
    </div>
  );
}
