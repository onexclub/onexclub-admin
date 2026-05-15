import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";

/**
 * Builds human-readable benefit lines for catalogue cards across the admin UI.
 * Kept declarative so marketing copy + onboarding dropdowns stay aligned visually.
 */

function humanBilling(cycle: string): string {
  const map: Record<string, string> = {
    monthly: "Monthly billing",
    quarterly: "Quarterly billing",
    half_yearly: "Half-yearly billing",
    yearly: "Annual billing",
  };
  return map[cycle] ?? `${cycle.replaceAll("_", " ")} billing`;
}

function fmtKey(label: string): string {
  return label
    .replaceAll(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turn feature JSON keys into bullets (`true` booleans only — keeps cards positive). */
function featureLines(features: Record<string, unknown>): string[] {
  const lines: string[] = [];

  const entries = Object.entries(features).filter(([key]) => !key.startsWith("_"));
  for (const [key, raw] of entries) {
    if (typeof raw === "boolean") {
      if (raw) lines.push(fmtKey(key));
      continue;
    }
    if (raw === null || raw === undefined || raw === "") {
      continue;
    }
    lines.push(`${fmtKey(key)}: ${String(raw)}`);
  }
  return lines;
}

export type PlanBenefitLine = { kind: "core" | "feature"; text: string };

export function buildPlanBenefitLines(plan: MembershipPlanAdminRow): PlanBenefitLine[] {
  const lines: PlanBenefitLine[] = [];

  if (typeof plan.duration_days === "number" && plan.duration_days > 0) {
    lines.push({ kind: "core", text: `${plan.duration_days}-day membership term (auto-calculates expiry)` });
  } else {
    lines.push({ kind: "core", text: "Open-ended term — admins set expiry manually" });
  }

  lines.push({ kind: "core", text: humanBilling(plan.billing_cycle) });

  if (plan.allow_cross_branch) {
    const cap =
      plan.cross_branch_visits_allowed == null
        ? "Unlimited"
        : `${plan.cross_branch_visits_allowed} visit${plan.cross_branch_visits_allowed === 1 ? "" : "s"} per quota`;
    const reset =
      plan.cross_branch_quota_period === "total"
        ? "lifetime cap"
        : "resets monthly (UTC calendar month)";
    lines.push({
      kind: "core",
      text: `Cross-branch access — ${cap} (${reset}).`,
    });
    lines.push({
      kind: "core",
      text: plan.cross_branch_org_only
        ? "Cross-branch stays within your gym brand (same organization)."
        : "Partner / network gyms allowed once enabled on data side.",
    });
  } else {
    lines.push({ kind: "core", text: "Single-branch access — home outlet only." });
  }

  if (plan.features_json && typeof plan.features_json === "object") {
    for (const text of featureLines(plan.features_json as Record<string, unknown>)) {
      lines.push({ kind: "feature", text });
    }
  }

  return lines;
}
