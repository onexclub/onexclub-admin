import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthDashboardContext } from "@/services/auth.service";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffMembersPanel } from "@/components/staff/StaffMembersPanel";

export default async function StaffMembersPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  const outletIds = ctx.staffAssignments.map((s) => s.outlet_id);
  if (!outletIds.length) {
    return (
      <EmptyState
        title="No outlet assignments"
        description="Ask a branch admin or owner to attach you to a branch in Staff assignments."
      />
    );
  }

  const { data: memberships, error } = await supabase
    .from("gym_memberships")
    .select(
      `
      id,
      outlet_id,
      status,
      profile_id,
      profiles!profile_id (
        full_name,
        email
      )
    `,
    )
    .in("outlet_id", outletIds)
    .is("deleted_at", null)
    .eq("status", "active");

  if (error) {
    return (
      <EmptyState
        title="Could not load members"
        description={error.message}
      />
    );
  }

  const rows =
    memberships?.map((m) => {
      const profiles = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
      return {
        membershipId: m.id as string,
        outletId: m.outlet_id as string,
        profileId: m.profile_id as string,
        fullName: profiles?.full_name ?? null,
        email: profiles?.email ?? null,
      };
    }) ?? [];

  const { data: outlets } = await supabase.from("outlets").select("id,name").in("id", outletIds);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Members</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Active members at your branch. Use check-in when someone arrives — it is saved with you as the staff member who recorded it.
        </p>
      </div>

      {!rows.length ? (
        <EmptyState title="No active members" description="When branch admins onboard members for your outlet, they will appear here." />
      ) : (
        <StaffMembersPanel members={rows} outlets={outlets ?? []} />
      )}
    </div>
  );
}
