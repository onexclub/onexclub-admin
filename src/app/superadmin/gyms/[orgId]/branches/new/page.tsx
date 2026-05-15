import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AddBranchForm } from "@/components/superadmin/AddBranchForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/utils/routes";

export default async function SuperadminAddBranchPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id,name,slug")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!org) {
    return (
      <EmptyState
        title="Organization not found"
        description="This organization does not exist (or was deleted)."
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Add gym branch</h2>
          <Link
            href={`${ROUTES.superadminGyms}/${org.id}`}
            className="text-sm font-medium text-orange-700 hover:underline dark:text-orange-400"
          >
            Back to organization
          </Link>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: <span className="font-medium text-zinc-900 dark:text-zinc-50">{org.name}</span>{" "}
          <span className="text-zinc-500 dark:text-zinc-500">({org.slug})</span>
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Branches are stored as <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">outlets</code> in the
          database; the console uses &quot;branch&quot; in the UI.
        </p>
      </div>

      <AddBranchForm organizationId={org.id} />
    </div>
  );
}
