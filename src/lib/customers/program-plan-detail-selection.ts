import type { ProgramPlanTemplateListItem } from "@/lib/admin/program-plan-templates";
import type { CustomerProgramPlanAssignment, CustomerProgramPlanType } from "@/lib/customers/customer-program-plans";
import { formatPlanDescriptionForDisplay } from "@/lib/customers/format-plan-description";

/** Props for {@link ProgramPlanTemplateDetailDialog} — from member assignment or admin catalogue. */
export type ProgramPlanDetailSelection = {
  planType: CustomerProgramPlanType;
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  primaryGoal: string | null;
  durationWeeks: number | null;
  /** Member progression tier, or template difficulty for catalogue browse. */
  tierLabel: string;
  outletId: string;
};

export function assignmentToDetailSelection(
  assignment: CustomerProgramPlanAssignment,
  outletId: string,
): ProgramPlanDetailSelection {
  return {
    planType: assignment.plan_type,
    templateId: assignment.template.id,
    templateName: assignment.template.name,
    templateDescription: formatPlanDescriptionForDisplay(assignment.template.description),
    primaryGoal: assignment.template.primary_goal,
    durationWeeks: assignment.template.duration_weeks,
    tierLabel: assignment.progression_tier,
    outletId,
  };
}

export function templateToDetailSelection(
  template: ProgramPlanTemplateListItem,
  outletId: string,
): ProgramPlanDetailSelection {
  return {
    planType: template.plan_type,
    templateId: template.id,
    templateName: template.name,
    templateDescription: formatPlanDescriptionForDisplay(template.description),
    primaryGoal: template.primary_goal,
    durationWeeks: template.duration_weeks,
    tierLabel: template.difficulty_level,
    outletId: template.outlet_id ?? outletId,
  };
}
