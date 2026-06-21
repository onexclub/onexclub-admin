import { countByDietType, formatDietLabel } from "./diet-compatibility";
import { mapDietTypeTag } from "./diet-tags";
import type { MatchDiagnostics, PlanTemplateRow, PlanTemplateType, UserProfile } from "./types";

export function buildMatchDiagnostics(params: {
  userProfile: UserProfile;
  templateType: PlanTemplateType;
  afterDemographicFilter: PlanTemplateRow[];
  afterDietFilter: PlanTemplateRow[];
  failureCategory: MatchDiagnostics["failureCategory"];
  extraMessage?: string;
}): MatchDiagnostics {
  const { userProfile, templateType, afterDemographicFilter, afterDietFilter, failureCategory } =
    params;
  const dietCounts = countByDietType(afterDemographicFilter);
  const memberDiet = mapDietTypeTag(userProfile.dietPreference ?? null);

  let message = params.extraMessage ?? "";

  if (!message && failureCategory === "insufficient_catalog") {
    if (templateType === "diet" && memberDiet && memberDiet !== "no_restrictions") {
      const matchingDiet = afterDietFilter.length;
      message =
        `No ${formatDietLabel(memberDiet)} diet templates for ` +
        `${userProfile.goal} / ${userProfile.level} / ${userProfile.gender}. ` +
        `Found ${afterDemographicFilter.length} plan(s) for goal+level+gender but ` +
        `${matchingDiet} match diet preference. ` +
        `Catalog breakdown: ${formatCatalogBreakdown(dietCounts)}.`;
    } else {
      message =
        `No active ${templateType} templates for ` +
        `${userProfile.goal} / ${userProfile.level} / ${userProfile.gender}.`;
    }
  }

  if (!message && failureCategory === "validation_rejected") {
    message = params.extraMessage ?? "Groq rejected the proposed template match.";
  }

  return {
    memberGoal: userProfile.goal,
    memberLevel: userProfile.level,
    memberGender: userProfile.gender,
    memberDiet: memberDiet ?? undefined,
    totalAfterGoalLevelGender: afterDemographicFilter.length,
    totalAfterDietFilter: afterDietFilter.length,
    dietTypesInCatalog: dietCounts,
    failureCategory,
    message,
  };
}

function formatCatalogBreakdown(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ");
}
