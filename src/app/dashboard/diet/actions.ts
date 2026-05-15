"use server";

import { revalidatePath } from "next/cache";
import { hasAccess, ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

function parseAttachments(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed.length) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export async function createDietPlanAction(formData: FormData): Promise<void> {
  const ctx = await getAuthDashboardContext();
  if (!ctx.user || !hasAccess(ctx.appRole, "diet_plans", "write")) return;

  const outletId = String(formData.get("outlet_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const isTemplate = formData.get("is_template") === "on";
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const notes = String(formData.get("trainer_notes") ?? "").trim();
  const attachments = String(formData.get("attachments_json") ?? "").trim();
  const validFrom = String(formData.get("valid_from") ?? "").trim();
  const validUntil = String(formData.get("valid_until") ?? "").trim();

  if (!title.length || !outletId.length) return;

  if (
    ctx.appRole !== ROLES.SUPERADMIN &&
    ctx.appRole !== ROLES.TRAINER &&
    !canManageOutletForBranchAdmin(ctx, outletId)
  ) {
    return;
  }

  const payload = {
    outlet_id: outletId,
    profile_id: isTemplate ? null : profileId.length ? profileId : null,
    is_template: isTemplate,
    title,
    trainer_notes: notes.length ? notes : null,
    plan_json: {},
    attachments_json: parseAttachments(attachments),
    valid_from: validFrom.length ? validFrom : null,
    valid_until: validUntil.length ? validUntil : null,
    is_active: true,
    created_by_profile: ctx.user.id,
  };

  if (!payload.is_template && !payload.profile_id) return;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("diet_plans").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath(ROUTES.dashboardDiet);
}
