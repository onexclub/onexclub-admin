"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles, Unlink } from "lucide-react";

import {
  assignCustomerProgramPlansAction,
  removeCustomerProgramPlansAction,
  type AssignCustomerProgramPlansState,
  type RemoveCustomerProgramPlansState,
} from "@/app/admin/customers/program-plans-actions";
import { ProgramPlanCard } from "@/components/dashboard/ProgramPlanCard";
import {
  assignmentToDetailSelection,
  type ProgramPlanDetailSelection,
} from "@/lib/customers/program-plan-detail-selection";
import { ProgramPlanTemplateDetailDialog } from "@/components/dashboard/ProgramPlanTemplateDetailDialog";
import {
  RemoveProgramPlanConfirmDialog,
  type RemoveProgramPlanConfirmTarget,
} from "@/components/dashboard/RemoveProgramPlanConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CustomerProgramPlanAssignment,
  type CustomerProgramPlansSnapshot,
} from "@/lib/customers/customer-program-plans";
import { cn } from "@/lib/utils/cn";

const assignInitial: AssignCustomerProgramPlansState = {};
const removeInitial: RemoveCustomerProgramPlansState = {};

function unlinkTargetForType(
  type: "exercise" | "diet",
  assignment: CustomerProgramPlanAssignment,
): RemoveProgramPlanConfirmTarget {
  const planName = assignment.template.name;
  if (type === "exercise") {
    return {
      scope: "exercise",
      title: "Unlink exercise program?",
      description: "This member will no longer have an active workout template. You can assign or re-match later.",
      planName,
    };
  }
  return {
    scope: "diet",
    title: "Unlink diet program?",
    description: "This member will no longer have an active meal template. You can assign or re-match later.",
    planName,
  };
}

/**
 * Exercise + diet template assignments for one member at a branch.
 *
 * **Reuse:** Hydrate via {@link fetchCustomerProgramPlans} on the membership page server component.
 * **Actions:** assign / re-match via {@link assignCustomerProgramPlansAction}; unlink via {@link removeCustomerProgramPlansAction}.
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
  const hasBoth = Boolean(snapshot.exercise && snapshot.diet);
  const [detailSelection, setDetailSelection] = useState<ProgramPlanDetailSelection | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<RemoveProgramPlanConfirmTarget | null>(null);

  const [assignState, assignAction, assignPending] = useActionState(assignCustomerProgramPlansAction, assignInitial);
  const [removeState, removeAction, removePending] = useActionState(removeCustomerProgramPlansAction, removeInitial);
  const removeFormRef = useRef<HTMLFormElement>(null);
  const scopeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (assignState.success) router.refresh();
  }, [assignState.success, router]);

  useEffect(() => {
    if (removeState.success) {
      setConfirmTarget(null);
      router.refresh();
    }
  }, [removeState.success, router]);

  const compact = variant === "compact";

  const openAssignmentDetail = (assignment: CustomerProgramPlanAssignment) => {
    setDetailSelection(assignmentToDetailSelection(assignment, outletId));
  };

  const openUnlinkConfirm = (target: RemoveProgramPlanConfirmTarget) => {
    setConfirmTarget(target);
  };

  const confirmRemove = () => {
    if (!confirmTarget || !scopeInputRef.current || !removeFormRef.current) return;
    scopeInputRef.current.value = confirmTarget.scope;
    removeFormRef.current.requestSubmit();
  };

  const feedbackError = assignState.error ?? removeState.error;
  const feedbackSuccess = assignState.success ?? removeState.success;

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
          onUnlink={
            canAssign && snapshot.exercise
              ? () => openUnlinkConfirm(unlinkTargetForType("exercise", snapshot.exercise!))
              : undefined
          }
        />
        <ProgramPlanCard
          mode="assignment"
          type="diet"
          assignment={snapshot.diet}
          compact={compact}
          onViewDetails={openAssignmentDetail}
          onUnlink={
            canAssign && snapshot.diet
              ? () => openUnlinkConfirm(unlinkTargetForType("diet", snapshot.diet!))
              : undefined
          }
        />
      </div>

      <ProgramPlanTemplateDetailDialog
        open={detailSelection != null}
        selection={detailSelection}
        onClose={() => setDetailSelection(null)}
      />

      <RemoveProgramPlanConfirmDialog
        open={confirmTarget != null}
        target={confirmTarget}
        memberName={memberName}
        pending={removePending}
        onConfirm={confirmRemove}
        onClose={() => {
          if (!removePending) setConfirmTarget(null);
        }}
      />

      {/* Hidden form — scope is set when the confirm dialog submits */}
      {canAssign ? (
        <form ref={removeFormRef} action={removeAction} className="hidden" aria-hidden>
          <input type="hidden" name="membership_id" value={membershipId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="outlet_id" value={outletId} />
          <input ref={scopeInputRef} type="hidden" name="scope" defaultValue="" />
        </form>
      ) : null}

      {canAssign ? (
        <div className="space-y-3">
          <form action={assignAction} className="space-y-2">
            <input type="hidden" name="membership_id" value={membershipId} />
            <input type="hidden" name="profile_id" value={profileId} />
            <input type="hidden" name="outlet_id" value={outletId} />
            <input type="hidden" name="has_active_assignments" value={hasActive ? "1" : "0"} />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                disabled={assignPending || removePending || !snapshot.intakeComplete}
                className="gap-2"
                variant={hasActive ? "secondary" : "default"}
              >
                <RefreshCw className={cn("size-4", assignPending && "animate-spin")} aria-hidden />
                {assignPending
                  ? "Matching plans…"
                  : hasActive
                    ? "Re-match from intake"
                    : "Assign exercise & diet plans"}
              </Button>

              {hasBoth ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={assignPending || removePending}
                  className="gap-2 border-zinc-300 text-zinc-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/30 dark:hover:text-rose-200"
                  onClick={() =>
                    openUnlinkConfirm({
                      scope: "both",
                      title: "Unlink both programs?",
                      description:
                        "Exercise and diet templates will be removed for this member. Assignment history is kept for your records.",
                    })
                  }
                >
                  <Unlink className="size-4" aria-hidden />
                  Unlink both
                </Button>
              ) : null}
            </div>

            {hasActive ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Re-matching cancels the current active templates and picks new ones from intake. Use{" "}
                <strong className="font-medium text-zinc-700 dark:text-zinc-300">Unlink</strong> on a card to remove a
                plan without assigning a replacement.
              </p>
            ) : null}
          </form>

          {feedbackError ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
            >
              {feedbackError}
            </p>
          ) : null}
          {feedbackSuccess ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              {feedbackSuccess}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
