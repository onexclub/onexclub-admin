import type { AssignableStaffRole } from "@/lib/auth/roles";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type StaffBranchAssignmentRow = {
  id: string;
  outletId: string;
  role: string;
  isPrimary: boolean;
  assignedAt: string | null;
};

export type SyncStaffBranchAccessInput = {
  profileId: string;
  role: AssignableStaffRole;
  /** Outlets that should have an active row after sync (subset of `manageableOutletIds`). */
  activeOutletIds: string[];
  primaryOutletId: string;
  manageableOutletIds: string[];
  assignedBy: string;
};

export type StaffBranchFormSelection =
  | { ok: true; activeOutletIds: string[]; primaryOutletId: string }
  | { ok: false; message: string };

export type SyncStaffBranchAccessResult =
  | { ok: true; message: string; primaryAssignmentId: string }
  | { ok: false; message: string };

/**
 * Reads branch fields from add/edit staff forms (`access_mode`, `outlet_id`, `outlet_ids`, `primary_outlet_id`).
 *
 * **Reuse:** `createStaffMemberAction` and `syncStaffBranchAssignmentsAction`.
 */
export function parseStaffBranchFormSelection(formData: FormData): StaffBranchFormSelection {
  const accessMode = String(formData.get("access_mode") ?? "").trim();
  const primaryOutletId = String(formData.get("primary_outlet_id") ?? "").trim();

  let activeOutletIds: string[];
  if (accessMode === "single") {
    const one = String(formData.get("outlet_id") ?? "").trim();
    activeOutletIds = one ? [one] : [];
  } else if (accessMode === "multi") {
    activeOutletIds = formData
      .getAll("outlet_ids")
      .map((v) => String(v).trim())
      .filter(Boolean);
  } else {
    return { ok: false, message: "Choose single-branch or multi-branch access." };
  }

  if (!activeOutletIds.length) {
    return { ok: false, message: "Select at least one branch." };
  }

  const primary = primaryOutletId || activeOutletIds[0]!;
  if (!activeOutletIds.includes(primary)) {
    return { ok: false, message: "Primary branch must be one of the selected locations." };
  }

  return { ok: true, activeOutletIds, primaryOutletId: primary };
}

/**
 * Aligns active `staff_assignments` rows for one profile with a target branch set.
 *
 * **Reuse / moderation:**
 * - One row per `(profile_id, outlet_id)`; revoked rows are **reactivated** instead of re-inserted.
 * - Rows at manageable outlets **not** in `activeOutletIds` are soft-revoked.
 * - New rows copy `role` from the sync input (e.g. shared `branch_admin` across branches).
 * - Call from `syncStaffBranchAssignmentsAction` after authz; do not skip `manageableOutletIds` checks.
 */
export async function syncStaffProfileBranchAccess(
  supabase: ServerSupabase,
  input: SyncStaffBranchAccessInput,
): Promise<SyncStaffBranchAccessResult> {
  const {
    profileId,
    role,
    activeOutletIds,
    primaryOutletId,
    manageableOutletIds,
    assignedBy,
  } = input;

  const allowed = new Set(manageableOutletIds);
  const target = [...new Set(activeOutletIds.filter((id) => allowed.has(id)))];

  if (!target.length) {
    return { ok: false, message: "Select at least one branch." };
  }
  if (!target.includes(primaryOutletId)) {
    return { ok: false, message: "Primary branch must be one of the selected locations." };
  }

  const { data: existingRows, error: loadErr } = await supabase
    .from("staff_assignments")
    .select("id,profile_id,outlet_id,role,is_primary,revoked_at")
    .eq("profile_id", profileId)
    .in("outlet_id", manageableOutletIds);

  if (loadErr) {
    return { ok: false, message: loadErr.message };
  }

  const byOutlet = new Map((existingRows ?? []).map((r) => [String(r.outlet_id), r]));
  const targetSet = new Set(target);

  for (const outletId of target) {
    const row = byOutlet.get(outletId);
    const isPrimary = outletId === primaryOutletId;

    if (row && row.revoked_at == null) {
      const { error } = await supabase
        .from("staff_assignments")
        .update({ role, is_primary: isPrimary })
        .eq("id", row.id);
      if (error) return { ok: false, message: error.message };
      continue;
    }

    if (row?.id) {
      const { error } = await supabase
        .from("staff_assignments")
        .update({
          role,
          is_primary: isPrimary,
          revoked_at: null,
          invite_pending: false,
          assigned_by: assignedBy,
          notes: "reactivated_via_branch_sync",
        })
        .eq("id", row.id);
      if (error) return { ok: false, message: error.message };
      continue;
    }

    const { error } = await supabase.from("staff_assignments").insert({
      profile_id: profileId,
      outlet_id: outletId,
      role,
      is_primary: isPrimary,
      assigned_by: assignedBy,
      invite_pending: false,
      notes: "added_via_branch_sync",
    });
    if (error) return { ok: false, message: error.message };
  }

  const toRevoke = (existingRows ?? []).filter(
    (r) => r.revoked_at == null && allowed.has(String(r.outlet_id)) && !targetSet.has(String(r.outlet_id)),
  );

  if (toRevoke.length) {
    const ids = toRevoke.map((r) => r.id);
    const { error } = await supabase
      .from("staff_assignments")
      .update({ revoked_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return { ok: false, message: error.message };
  }

  const { data: primaryRow, error: primaryErr } = await supabase
    .from("staff_assignments")
    .select("id")
    .eq("profile_id", profileId)
    .eq("outlet_id", primaryOutletId)
    .is("revoked_at", null)
    .maybeSingle();

  if (primaryErr || !primaryRow?.id) {
    return { ok: false, message: primaryErr?.message ?? "Could not resolve primary assignment." };
  }

  const branchWord = target.length === 1 ? "branch" : `${target.length} branches`;
  return { ok: true, message: `Branch access updated (${branchWord}).`, primaryAssignmentId: primaryRow.id };
}
