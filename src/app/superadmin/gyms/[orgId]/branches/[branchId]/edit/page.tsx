import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EditBranchForm } from "@/components/superadmin/EditBranchForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/utils/routes";

export default async function SuperadminEditBranchPage({
  params,
}: {
  params: Promise<{ orgId: string; branchId: string }>;
}) {
  const { orgId, branchId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: org }, { data: outlet }] = await Promise.all([
    supabase.from("organizations").select("id,name,slug").eq("id", orgId).is("deleted_at", null).maybeSingle(),
    supabase
      .from("outlets")
      .select(
        "id,organization_id,name,address,city,state,country,phone,email,is_active",
      )
      .eq("id", branchId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!org || !outlet) {
    return (
      <EmptyState
        title={!org ? "Organization not found" : "Branch not found"}
        description="Open All gyms and pick a valid organization and branch."
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
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Edit branch</h2>
        <Link
          href={`${ROUTES.superadminGyms}/${org.id}`}
          className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
        >
          Back to branches
        </Link>
      </div>

      <EditBranchForm
        organizationName={org.name}
        branch={{
          id: outlet.id,
          organizationId: String(outlet.organization_id),
          name: outlet.name ?? "",
          address: outlet.address ?? "",
          city: outlet.city ?? "",
          state: outlet.state ?? "",
          country: String(outlet.country ?? "").trim(),
          phone: outlet.phone ?? null,
          email: outlet.email ?? null,
          is_active: Boolean(outlet.is_active),
        }}
      />
    </div>
  );
}
