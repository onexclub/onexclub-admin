"use client";

import { ChevronRight, Dumbbell, UtensilsCrossed } from "lucide-react";

import type { ProgramPlanTemplateListItem } from "@/lib/admin/program-plan-templates";
import { formatTemplateAudience, formatTemplateScoreBand } from "@/lib/admin/program-plan-templates";
import {
  type CustomerProgramPlanAssignment,
  formatProgramGoal,
} from "@/lib/customers/customer-program-plans";
import { computeProgramSchedulePercent } from "@/lib/customers/program-plan-template-detail";
import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ProgramPlanCardProps =
  | {
      mode: "assignment";
      type: "exercise" | "diet";
      assignment: CustomerProgramPlanAssignment | null;
      compact?: boolean;
      onViewDetails: (assignment: CustomerProgramPlanAssignment) => void;
    }
  | {
      mode: "catalog";
      type: "exercise" | "diet";
      template: ProgramPlanTemplateListItem;
      /** Optional override for the Scope stat (e.g. superadmin org · branch label). */
      scopeDetail?: string;
      compact?: boolean;
      onViewDetails: (template: ProgramPlanTemplateListItem) => void;
    };

function statusBadgeVariant(status: string): "success" | "warning" | "default" | "danger" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  if (status === "completed") return "default";
  if (status === "cancelled") return "danger";
  return "default";
}

function matchMethodLabel(method: string): string {
  if (method === "auto") return "Auto-matched";
  if (method === "manual") return "Staff assigned";
  if (method === "ai") return "AI matched";
  return method;
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function Stat(props: { label: string; value: string; className?: string }) {
  return (
    <div className={props.className}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{props.label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{props.value}</dd>
    </div>
  );
}

/**
 * Exercise/diet plan card — shared by member workspace and admin catalogue pages.
 *
 * **Reuse:**
 * - {@link CustomerProgramPlansPanel} (`mode="assignment"`)
 * - {@link ProgramPlanCatalogClient} (`mode="catalog"`)
 */
export function ProgramPlanCard(props: ProgramPlanCardProps) {
  const { type, compact = false } = props;
  const isExercise = type === "exercise";
  const Icon = isExercise ? Dumbbell : UtensilsCrossed;
  const title = isExercise ? "Exercise program" : "Diet program";
  const accent = isExercise
    ? "from-violet-500/10 to-violet-600/5 border-violet-200/80 dark:border-violet-900/40"
    : "from-emerald-500/10 to-emerald-600/5 border-emerald-200/80 dark:border-emerald-900/40";
  const iconTone = isExercise ? "text-violet-600 dark:text-violet-400" : "text-emerald-600 dark:text-emerald-400";

  if (props.mode === "assignment" && !props.assignment) {
    return (
      <Card className={cn("border-dashed bg-zinc-50/50 dark:bg-zinc-900/20", accent)}>
        <CardHeader className={compact ? "p-4 pb-2" : undefined}>
          <div className="flex items-center gap-2">
            <Icon className={cn("size-4", iconTone)} aria-hidden />
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          <CardDescription>No active plan assigned yet.</CardDescription>
        </CardHeader>
        <CardContent className={compact ? "p-4 pt-0" : undefined}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isExercise
              ? "Assign to match a workout template from goals, fitness level, and demographics."
              : "Assign to match a meal template from diet preferences and health screening."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const assignment = props.mode === "assignment" ? props.assignment! : null;
  const template =
    props.mode === "assignment"
      ? assignment!.template
      : {
          id: props.template.id,
          name: props.template.name,
          description: props.template.description,
          duration_weeks: props.template.duration_weeks,
          difficulty_level: props.template.difficulty_level,
          primary_goal: props.template.primary_goal,
        };

  const weeksTotal = template.duration_weeks ?? null;
  const schedulePercent =
    assignment != null
      ? computeProgramSchedulePercent(assignment.current_week, assignment.current_day, weeksTotal)
      : null;
  const atStart = assignment != null && assignment.current_week === 1 && assignment.current_day === 1;

  const handleClick = () => {
    if (props.mode === "assignment") {
      props.onViewDetails(props.assignment!);
    } else {
      props.onViewDetails(props.template);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group w-full text-left transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      <Card className={cn("overflow-hidden border bg-gradient-to-br transition group-hover:shadow-md", accent)}>
        <CardHeader className={cn("space-y-3", compact ? "p-4 pb-2" : undefined)}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={cn("rounded-lg bg-white/80 p-2 shadow-sm dark:bg-zinc-900/80", iconTone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-sm leading-snug">{template.name}</CardTitle>
                <CardDescription className="mt-0.5">{title}</CardDescription>
              </div>
            </div>
            {assignment ? (
              <Badge variant={statusBadgeVariant(assignment.status)}>{assignment.status}</Badge>
            ) : props.mode === "catalog" && !props.template.is_active ? (
              <Badge variant="warning">Inactive</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-3", compact ? "p-4 pt-0" : undefined)}>
          {template.description && !compact ? (
            <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{template.description}</p>
          ) : null}

          {props.mode === "assignment" && assignment ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Stat label="Tier" value={tierLabel(assignment.progression_tier)} />
              <Stat label="Goal" value={formatProgramGoal(template.primary_goal)} />
              <Stat label="Match" value={matchMethodLabel(assignment.match_method)} />
              <Stat
                label="Match score"
                value={
                  assignment.matched_score != null && assignment.matched_score > 0
                    ? String(assignment.matched_score)
                    : "Recalculate on assign"
                }
              />
              <Stat
                label="Progress"
                value={
                  weeksTotal
                    ? `Week ${assignment.current_week} of ${weeksTotal} · Day ${assignment.current_day}`
                    : `Week ${assignment.current_week} · Day ${assignment.current_day}`
                }
                className="col-span-2"
              />
              <Stat
                label="Assigned"
                value={formatMembershipTimestampUtcLabel(assignment.assigned_at)}
                className="col-span-2"
              />
            </dl>
          ) : props.mode === "catalog" ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Stat label="Tier" value={tierLabel(props.template.difficulty_level)} />
              <Stat label="Goal" value={formatProgramGoal(template.primary_goal)} />
              <Stat
                label="Duration"
                value={weeksTotal ? `${weeksTotal} weeks` : "Flexible"}
              />
              <Stat label="Audience" value={formatTemplateAudience(props.template)} />
              {formatTemplateScoreBand(props.template) ? (
                <Stat label="Intake score" value={formatTemplateScoreBand(props.template)!} className="col-span-2" />
              ) : null}
              <Stat
                label="Scope"
                value={
                  props.scopeDetail ??
                  (props.template.outlet_id ? "Branch template" : "Platform-wide")
                }
                className="col-span-2"
              />
            </dl>
          ) : null}

          {schedulePercent != null && !atStart ? (
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <span>Schedule position</span>
                <span>{schedulePercent}%</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800"
                role="progressbar"
                aria-valuenow={schedulePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Position in program schedule"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isExercise ? "bg-violet-600 dark:bg-violet-500" : "bg-emerald-600 dark:bg-emerald-500",
                  )}
                  style={{ width: `${schedulePercent}%` }}
                />
              </div>
            </div>
          ) : atStart && weeksTotal ? (
            <p className="text-[10px] text-zinc-500">Just started · Week 1 of {weeksTotal}</p>
          ) : null}

          <p className="flex items-center gap-1 text-xs font-medium text-orange-600 opacity-0 transition group-hover:opacity-100 dark:text-orange-400">
            View full plan
            <ChevronRight className="size-3.5" aria-hidden />
          </p>

          {assignment && assignment.plan_sequence > 1 ? (
            <p className="text-[10px] text-zinc-500">Plan #{assignment.plan_sequence} for this member</p>
          ) : null}
        </CardContent>
      </Card>
    </button>
  );
}
