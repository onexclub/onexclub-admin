"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";

import {
  assignCustomerProgramPlansAction,
  type AssignCustomerProgramPlansState,
} from "@/app/admin/customers/program-plans-actions";
import { ProgramPlanCard } from "@/components/dashboard/ProgramPlanCard";
import {
  assignmentToDetailSelection,
  type ProgramPlanDetailSelection,
} from "@/lib/customers/program-plan-detail-selection";
import { ProgramPlanTemplateDetailDialog } from "@/components/dashboard/ProgramPlanTemplateDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CustomerProgramPlanAssignment,
  type CustomerProgramPlansSnapshot,
} from "@/lib/customers/customer-program-plans";
import { cn } from "@/lib/utils/cn";

const assignInitial: AssignCustomerProgramPlansState = {};

/**
 * Exercise + diet template assignments for one member at a branch.
 *
 * **Reuse:** Hydrate via {@link fetchCustomerProgramPlans} on the membership page server component.
 * **Actions:** `assignCustomerProgramPlansAction` → DB RPC `assign_or_rotate_plans`.
 */
export function CustomerProgramPlansPanel(props: {
  membershipId: string;
  profileId: string;
  outletId: string;
  memberName: string;
  snapshot: CustomerProgramPlansSnapshot;
  canAssign: boolean;
  /** Compact layout for the Review step summary. */
  variant?: "full" | "compact";
}) {
  const { membershipId, profileId, outletId, memberName, snapshot, canAssign, variant = "full" } = props;
  const router = useRouter();
  const hasActive = Boolean(snapshot.exercise || snapshot.diet);
  const [detailSelection, setDetailSelection] = useState<ProgramPlanDetailSelection | null>(null);

  const [state, action, pending] = useActionState(assignCustomerProgramPlansAction, assignInitial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const compact = variant === "compact";

  const openAssignmentDetail = (assignment: CustomerProgramPlanAssignment) => {
    setDetailSelection(assignmentToDetailSelection(assignment, outletId));
  };

  return (
    <section className={cn("space-y-4", compact ? "" : "rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50/90 via-white to-orange-50/30 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-950/80 dark:via-zinc-950 dark:to-orange-950/10 sm:p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-orange-600 dark:text-orange-400" aria-hidden />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {compact ? "Program plans" : "Training & nutrition programs"}
            </h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {compact
              ? "Matched exercise and diet templates for this member."
              : `Template-based workout and meal programs for ${memberName}. Plans are matched from intake answers and body metrics.`}
          </p>
        </div>
        {!snapshot.intakeComplete ? (
          <Badge variant="warning">Intake incomplete</Badge>
        ) : hasActive ? (
          <Badge variant="success">Plans active</Badge>
        ) : (
          <Badge variant="outline">Not assigned</Badge>
        )}
      </div>

      {!snapshot.intakeComplete ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Finish <strong>Basic info</strong>, <strong>Health screening</strong>, and{" "}
          <strong>Diet preferences</strong> before assigning or re-matching program plans.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ProgramPlanCard
          mode="assignment"
          type="exercise"
          assignment={snapshot.exercise}
          compact={compact}
          onViewDetails={openAssignmentDetail}
        />
        <ProgramPlanCard
          mode="assignment"
          type="diet"
          assignment={snapshot.diet}
          compact={compact}
          onViewDetails={openAssignmentDetail}
        />
      </div>

      <ProgramPlanTemplateDetailDialog
        open={detailSelection != null}
        selection={detailSelection}
        onClose={() => setDetailSelection(null)}
      />

      {canAssign ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="membership_id" value={membershipId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="outlet_id" value={outletId} />
          <input type="hidden" name="has_active_assignments" value={hasActive ? "1" : "0"} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={pending || !snapshot.intakeComplete}
              className="gap-2"
              variant={hasActive ? "secondary" : "default"}
            >
              <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
              {pending
                ? "Matching plans…"
                : hasActive
                  ? "Re-match from intake"
                  : "Assign exercise & diet plans"}
            </Button>
            {hasActive ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Re-matching cancels the current active templates and picks new ones from intake.
              </p>
            ) : null}
          </div>

          {state.error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              {state.success}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
