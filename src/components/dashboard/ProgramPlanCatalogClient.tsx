"use client";

import { useMemo, useState } from "react";

import { ProgramPlanCard } from "@/components/dashboard/ProgramPlanCard";
import { ProgramPlanTemplateDetailDialog } from "@/components/dashboard/ProgramPlanTemplateDetailDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ProgramPlanTemplateListItem } from "@/lib/admin/program-plan-templates";
import type { CustomerProgramPlanType } from "@/lib/customers/customer-program-plans";
import {
  templateToDetailSelection,
  type ProgramPlanDetailSelection,
} from "@/lib/customers/program-plan-detail-selection";

/**
 * Admin catalogue grid for `plan_templates` (exercise or diet).
 *
 * **Reuse:** Same {@link ProgramPlanCard} + {@link ProgramPlanTemplateDetailDialog} as member onboarding.
 */
export function ProgramPlanCatalogClient(props: {
  planType: CustomerProgramPlanType;
  templates: ProgramPlanTemplateListItem[];
  /** Fallback outlet for platform-wide templates when opening detail modal auth scope. */
  defaultOutletId: string;
  title: string;
  description: string;
}) {
  const { planType, templates, defaultOutletId, title, description } = props;
  const [detail, setDetail] = useState<ProgramPlanDetailSelection | null>(null);
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const goals = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.primary_goal) set.add(t.primary_goal);
    });
    return [...set].sort();
  }, [templates]);

  const tiers = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.difficulty_level));
    return [...set].sort();
  }, [templates]);

  const filtered = templates.filter((t) => {
    if (goalFilter !== "all" && t.primary_goal !== goalFilter) return false;
    if (tierFilter !== "all" && t.difficulty_level !== tierFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>

      {templates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Goal</span>
            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="all">All goals</option>
              {goals.map((g) => (
                <option key={g} value={g}>
                  {g.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Tier</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="all">All tiers</option>
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-zinc-500">
            {filtered.length} of {templates.length} templates
          </p>
        </div>
      ) : null}

      {!templates.length ? (
        <EmptyState
          title="No templates yet"
          description="Program templates for this branch will appear here once published in Supabase (`plan_templates`)."
        />
      ) : !filtered.length ? (
        <EmptyState title="No matches" description="Try clearing the goal or tier filters." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => (
            <ProgramPlanCard
              key={template.id}
              mode="catalog"
              type={planType}
              template={template}
              onViewDetails={(t) => setDetail(templateToDetailSelection(t, defaultOutletId))}
            />
          ))}
        </div>
      )}

      <ProgramPlanTemplateDetailDialog
        open={detail != null}
        selection={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
