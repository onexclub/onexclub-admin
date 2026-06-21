import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanTemplateType, UserProfile } from "./types";

/** Upsert a gap row when no verified template matches the member profile. */
export async function logTemplateGap(
  supabase: SupabaseClient,
  userProfile: UserProfile,
  templateType: PlanTemplateType,
): Promise<void> {
  const constraints = [...userProfile.injuries, ...userProfile.allergies].sort();

  const { error } = await supabase.rpc("log_template_gap", {
    p_template_type: templateType,
    p_goal: userProfile.goal,
    p_level: userProfile.level,
    p_gender: userProfile.gender,
    p_constraints: constraints,
  });

  if (error) {
    // Fallback direct upsert when RPC not yet deployed
    await supabase.from("template_gaps").upsert(
      {
        template_type: templateType,
        goal: userProfile.goal,
        level: userProfile.level,
        gender: userProfile.gender,
        constraints,
        hit_count: 1,
        last_requested_at: new Date().toISOString(),
      },
      { onConflict: "template_type,goal,level,gender,constraints" },
    );
  }
}
