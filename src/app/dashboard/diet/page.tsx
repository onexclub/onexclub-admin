import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DashboardFeature } from "@/lib/auth/roles";
import { createDietPlanAction } from "@/app/dashboard/diet/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";

const FEATURE: DashboardFeature = "diet_plans";

export default async function DashboardDietPlansPage() {
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);

  const { data: outlets } = outletIds.length
    ? await supabase.from("outlets").select("id,name,city").in("id", outletIds).is("deleted_at", null)
    : { data: [] as { id: string; name: string; city: string | null }[] };

  const { data: rows, error } = outletIds.length
    ? await supabase
        .from("diet_plans")
        .select(
          "id,title,is_template,valid_from,valid_until,outlet_id,is_active,profiles!diet_plans_profile_id_fkey(email,full_name)",
        )
        .is("deleted_at", null)
        .in("outlet_id", outletIds)
        .order("updated_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Diet plans</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Templates anchor branch playbooks; personalised rows carry `profile_id` + optional attachment URLs (validated before insert). Schema: `supabase/migrations/008_dashboard_diet_exercise_staff_rls.sql`.
          </p>
        </div>

        {!outletIds.length ? (
          <EmptyState title="Awaiting branch scope" description="You need an outlet assignment to load diet plans." />
        ) : error ? (
          <EmptyState title="Supabase error" description={error.message} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Window</th>
                    <th className="px-4 py-3">Kind</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {(rows ?? []).map((row) => {
                    const profile = row.profiles as { email?: string | null; full_name?: string | null } | null;
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold">{row.title}</td>
                        <td className="px-4 py-3 text-xs">{row.outlet_id}</td>
                        <td className="px-4 py-3 text-xs">{profile?.email ?? profile?.full_name ?? "Template"}</td>
                        <td className="px-4 py-3 text-xs font-mono">
                          {row.valid_from ?? "—"} → {row.valid_until ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs">{row.is_template ? "Template" : "Member"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <RoleGuard role={ctx.appRole} feature={FEATURE} requireWrite>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                <h3 className="text-lg font-semibold">Create plan</h3>
                <form action={createDietPlanAction} className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    Branch
                    <select name="outlet_id" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-black/30">
                      {(outlets ?? []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.city ? `· ${o.city}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    Title
                    <input required name="title" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-black/30" />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
                    <input type="checkbox" name="is_template" defaultChecked /> Template (no profile)
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
                    Member profile UUID (omit for templates)
                    <input name="profile_id" className="rounded-lg border px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-black/30" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
                    Coach notes
                    <textarea name="trainer_notes" className="min-h-[80px] rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-black/30" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
                    Attachments JSON or comma-separated URLs
                    <textarea
                      name="attachments_json"
                      placeholder='["https://..."]'
                      className="min-h-[60px] rounded-lg border px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-black/30"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    Valid from
                    <input type="date" name="valid_from" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-black/30" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    Valid until
                    <input type="date" name="valid_until" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-black/30" />
                  </label>
                  <button
                    type="submit"
                    className="md:col-span-2 h-11 rounded-xl bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    Save diet plan
                  </button>
                </form>
              </section>
            </RoleGuard>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
