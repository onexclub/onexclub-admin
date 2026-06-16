"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, RotateCcw, Save } from "lucide-react";
import {
  loadExistingCustomerPrefillAction,
  lookupExistingCustomerAction,
  onboardMemberWizardAction,
  type OnboardMemberWizardState,
} from "@/app/admin/members/onboard/actions";
import { ExistingCustomerLinkDialog, SameBranchOnboardBanner } from "@/components/dashboard/customer-onboard/ExistingCustomerLinkDialog";
import type { ExistingCustomerMatch, CustomerGymHistoryEntry } from "@/lib/customers/customer-lookup";
import { membershipNoticeForOutlet } from "@/lib/customers/customer-lookup";
import { applyExistingCustomerPrefillToDraft } from "@/lib/customers/customer-onboard-prefill";
import { normalizeToE164 } from "@/lib/auth/phone-e164";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import type { UserRole } from "@/lib/auth/roles";
import { customerMemberContactCopy } from "@/lib/auth/role-sign-in-policy";
import { BMI_BAND_LABEL, bmiBandTone, classifyBmi } from "@/lib/customers/bmi-band";
import {
  buildQuestionnairePayload,
  clearDraft,
  emptyDraft,
  loadDraft,
  normalizeDraft,
  saveDraft,
  draftStorageKey,
  WIZARD_REVIEW_STEP,
  WIZARD_STEP_LABELS,
  type CustomerOnboardDraft,
} from "@/lib/customers/customer-onboard-draft";
import type { OnboardingFormName } from "@/features/onboarding/types";
import { formatInrPrice } from "@/lib/customers/format-inr";
import { ONBOARDING_FORM, SECTION_COPY } from "@/features/onboarding/constants";
import { formatAnswerPreview } from "@/features/onboarding/format-answer-preview";
import { useOnboardingDefinitions } from "@/features/onboarding/hooks/useOnboardingForms";
import {
  filterDefinitionBundleForMember,
  type MemberQuestionContext,
} from "@/features/onboarding/question-visibility";
import {
  validateQuestionnaireSection,
} from "@/features/onboarding/validate-questionnaire-answers";
import { computeBmiFromMetrics, genderLabel } from "@/lib/profile/vitals";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ReviewRow } from "@/components/dashboard/customer-onboard/ReviewRow";
import { IndiaPhoneInput } from "@/components/dashboard/IndiaPhoneInput";
import { TrainerSelectField } from "@/components/dashboard/TrainerSelectField";
import type { TrainerLite } from "@/lib/customers/membership-detail";
import { trainerDisplayLabel, trainersForOutletFromGrouped } from "@/lib/admin/outlet-trainers";
import { canAssignDedicatedTrainer } from "@/lib/auth/roles";
import { dashboardCustomerMembershipPath, ROUTES } from "@/utils/routes";
import { WizardFormQuestionsStep } from "./WizardFormQuestionsStep";
import { WizardStepper } from "./WizardStepper";

/** Wizard step index → `question_definitions.form_name` for intake steps 2–4. */
const INTAKE_STEP_FORM: Record<number, OnboardingFormName> = {
  2: ONBOARDING_FORM.basic,
  3: ONBOARDING_FORM.health,
  4: ONBOARDING_FORM.diet,
};

type OutletOption = {
  id: string;
  name: string;
  city: string | null;
  organization_id: string;
  organization_name: string | null;
};

const initialWizard: OnboardMemberWizardState = {};

const labelCn = "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const inputCn =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-sm text-zinc-900 outline-none ring-orange-500/25 transition focus:border-orange-500 focus:bg-white focus:ring-4 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:focus:bg-zinc-950";
const selectedTileCn =
  "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/40";

function outletLabel(o: OutletOption): string {
  return o.city?.length ? `${o.name} · ${o.city}` : o.name;
}

function formatPhoneDisplay(phone: string): string {
  const normalized = normalizeToE164(phone);
  return normalized.ok ? normalized.e164 : phone;
}

function hasValidOnboardBodyMetrics(health: CustomerOnboardDraft["health"]): boolean {
  const heightRaw = health.heightCm.trim();
  const weightRaw = health.weightKg.trim();
  if (!heightRaw || !weightRaw) return false;
  const h = Number(heightRaw);
  const w = Number(weightRaw);
  return Number.isFinite(h) && h >= 50 && h <= 280 && Number.isFinite(w) && w >= 20 && w <= 400;
}

/**
 * 6-step add-customer wizard — Identity → Membership → Basic Info → Health Screening → Diet → Review.
 *
 * **Moderation:** intake questions reuse `WizardFormQuestionsStep` + `DynamicQuestionRenderer`.
 */
export function CustomerOnboardWizard(props: {
  outlets: OutletOption[];
  plans: MembershipPlanAdminRow[];
  defaultStartDate: string;
  actorProfileId: string;
  ctxRole: UserRole;
  /** Outlet → coaches for Review-step assignment (`listTrainersGroupedByOutlet`). */
  trainersByOutlet: Record<string, TrainerLite[]>;
  /** Working branch from header switcher / post-login chooser; falls back to first outlet. */
  preferredOutletId?: string | null;
}) {
  const { outlets, plans: allPlans, defaultStartDate, actorProfileId, ctxRole, trainersByOutlet, preferredOutletId } =
    props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactCopy = customerMemberContactCopy();
  const storageKey = draftStorageKey(actorProfileId);
  const defaultOutletId =
    (preferredOutletId && outlets.some((o) => o.id === preferredOutletId) ? preferredOutletId : null) ??
    outlets[0]?.id ??
    "";

  const staffOrganizationIds = useMemo(
    () => [...new Set(outlets.map((o) => o.organization_id).filter(Boolean))],
    [outlets],
  );

  const [draft, setDraft] = useState<CustomerOnboardDraft>(() =>
    emptyDraft(defaultOutletId, defaultStartDate),
  );
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [lookupMatch, setLookupMatch] = useState<ExistingCustomerMatch | null>(null);
  /** Kept after link confirm so Membership step can warn about same-branch onboard. */
  const [linkedGymHistory, setLinkedGymHistory] = useState<CustomerGymHistoryEntry[]>([]);

  const selectedOutletMembershipNotice = useMemo(() => {
    if (!draft.linkExistingProfileId || !linkedGymHistory.length) return null;
    return membershipNoticeForOutlet(linkedGymHistory, draft.membership.outletId);
  }, [draft.linkExistingProfileId, draft.membership.outletId, linkedGymHistory]);

  const { data: questionDefinitions, isPending: definitionsLoading } = useOnboardingDefinitions(
    draft.membership.outletId || null,
  );

  const memberQuestionContext = useMemo<MemberQuestionContext>(
    () => ({ gender: draft.identity.gender || null }),
    [draft.identity.gender],
  );

  const applicableQuestionDefinitions = useMemo(
    () => (questionDefinitions ? filterDefinitionBundleForMember(questionDefinitions, memberQuestionContext) : undefined),
    [questionDefinitions, memberQuestionContext],
  );

  const [state, formAction, pending] = useActionState(onboardMemberWizardAction, initialWizard);

  useEffect(() => {
    const resume = searchParams.get("resume") === "1";
    if (resume) {
      const saved = loadDraft(storageKey);
      if (saved?.savedAt) {
        setDraft(normalizeDraft(saved, defaultOutletId, defaultStartDate));
        const ts = Date.parse(saved.savedAt);
        if (!Number.isNaN(ts)) setDraftSavedAt(ts);
      }
    }
    setHydrated(true);
  }, [storageKey, defaultOutletId, defaultStartDate, searchParams]);

  useEffect(() => {
    if (state.membershipId) {
      clearDraft(storageKey);
      router.push(dashboardCustomerMembershipPath(state.membershipId));
    }
  }, [state.membershipId, router, storageKey]);

  const visiblePlans = useMemo(
    () => allPlans.filter((p) => p.outlet_id === draft.membership.outletId && p.is_active),
    [allPlans, draft.membership.outletId],
  );

  const selectedPlan = visiblePlans.find((p) => p.id === draft.membership.planId) ?? null;
  const outletTrainers = trainersForOutletFromGrouped(
    new Map(Object.entries(trainersByOutlet)),
    draft.membership.outletId,
  );
  const selectedTrainer =
    outletTrainers.find((t) => t.id === draft.membership.assignedTrainerId) ?? null;
  const canAssignTrainer = canAssignDedicatedTrainer(ctxRole);

  const bmi = computeBmiFromMetrics(
    draft.health.heightCm ? Number(draft.health.heightCm) : null,
    draft.health.weightKg ? Number(draft.health.weightKg) : null,
  );
  const bmiBand = classifyBmi(bmi);
  const bmiTone = bmiBandTone(bmiBand);

  const patch = useCallback((partial: Partial<CustomerOnboardDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchIdentity = useCallback(
    (partial: Partial<CustomerOnboardDraft["identity"]>) => {
      let shouldClearHistory = false;
      setDraft((prev) => {
        const nextIdentity = { ...prev.identity, ...partial };
        const phoneChanged =
          partial.phone != null && partial.phone.trim() !== prev.identity.phone.trim();
        const emailChanged =
          partial.email != null &&
          partial.email.trim().toLowerCase() !== prev.identity.email.trim().toLowerCase();
        shouldClearHistory = phoneChanged || emailChanged;
        const shouldClearLink =
          shouldClearHistory &&
          (prev.linkExistingProfileId != null || prev.lookupConfirmedPhone != null);

        return {
          ...prev,
          identity: nextIdentity,
          ...(shouldClearLink
            ? { linkExistingProfileId: null, lookupConfirmedPhone: null }
            : {}),
        };
      });
      if (shouldClearHistory) {
        setLinkedGymHistory([]);
      }
    },
    [],
  );

  const patchMembership = useCallback(
    (partial: Partial<CustomerOnboardDraft["membership"]>) => {
      setDraft((prev) => {
        const outletChanged = partial.outletId != null && partial.outletId !== prev.membership.outletId;
        return {
          ...prev,
          membership: {
            ...prev.membership,
            ...partial,
            ...(outletChanged ? { assignedTrainerId: "" } : {}),
          },
          ...(outletChanged ? { questionnaireAnswers: {} } : {}),
        };
      });
    },
    [],
  );

  const patchHealth = useCallback(
    (partial: Partial<CustomerOnboardDraft["health"]>) => {
      setDraft((prev) => ({ ...prev, health: { ...prev.health, ...partial } }));
    },
    [],
  );

  const onQuestionnaireSectionChange = useCallback(
    (formName: OnboardingFormName, sectionAnswers: Record<string, unknown>) => {
      setDraft((prev) => ({
        ...prev,
        questionnaireAnswers: {
          ...prev.questionnaireAnswers,
          [formName]: sectionAnswers,
        },
      }));
    },
    [],
  );

  const stepValid = useMemo(() => {
    switch (draft.step) {
      case 0: {
        const localDigits = draft.identity.phone.replace(/\D/g, "");
        return (
          draft.identity.fullName.trim().length > 0 &&
          localDigits.length === 10 &&
          (draft.identity.gender === "male" ||
            draft.identity.gender === "female" ||
            draft.identity.gender === "other")
        );
      }
      case 1:
        return draft.membership.outletId.length > 0 && draft.membership.startDate.length > 0;
      case 2: {
        if (!hasValidOnboardBodyMetrics(draft.health)) return false;
        if (!questionDefinitions || definitionsLoading) return false;
        return validateQuestionnaireSection(
          questionDefinitions,
          INTAKE_STEP_FORM[2],
          draft.questionnaireAnswers,
          memberQuestionContext,
        );
      }
      case 3:
      case 4: {
        if (!questionDefinitions || definitionsLoading) return false;
        const formName = INTAKE_STEP_FORM[draft.step];
        return validateQuestionnaireSection(
          questionDefinitions,
          formName,
          draft.questionnaireAnswers,
          memberQuestionContext,
        );
      }
      case 5:
        return true;
      default:
        return false;
    }
  }, [draft, questionDefinitions, definitionsLoading, memberQuestionContext]);

  const handleSaveDraftClick = () => {
    const savedAt = new Date().toISOString();
    const toSave = { ...draft, savedAt };
    setDraft(toSave);
    saveDraft(storageKey, toSave);
    setDraftSavedAt(Date.now());
  };

  const handleStartFresh = () => {
    clearDraft(storageKey);
    setDraft(emptyDraft(defaultOutletId, defaultStartDate));
    setDraftSavedAt(null);
    setStepError(null);
    setLookupModalOpen(false);
    setLookupMatch(null);
    setLinkedGymHistory([]);
    if (searchParams.get("resume") === "1") {
      router.replace(ROUTES.dashboardCustomerNew);
    }
  };

  const applyExistingCustomerToDraft = useCallback(async (match: ExistingCustomerMatch) => {
    const phoneNorm = normalizeToE164(draft.identity.phone.trim());
    if (!phoneNorm.ok) {
      setStepError(phoneNorm.message);
      return;
    }

    setLookupPending(true);
    setStepError(null);
    try {
      const formData = new FormData();
      formData.set("profile_id", match.profile_id);
      formData.set("gym_history_json", JSON.stringify(match.gym_history));
      const { error, prefill } = await loadExistingCustomerPrefillAction({}, formData);

      if (error || !prefill) {
        setStepError(error ?? "Could not load member details.");
        return;
      }

      setDraft((prev) => applyExistingCustomerPrefillToDraft(prev, prefill, phoneNorm.e164));
      setLinkedGymHistory(match.gym_history);
      setLookupModalOpen(false);
      setLookupMatch(null);
    } finally {
      setLookupPending(false);
    }
  }, [draft.identity.phone]);

  const advanceFromIdentityStep = async () => {
    if (!stepValid) {
      if (!draft.identity.gender) {
        setStepError("Please select a gender before continuing.");
      }
      return;
    }
    setStepError(null);

    const phoneNorm = normalizeToE164(draft.identity.phone.trim());
    if (!phoneNorm.ok) {
      setStepError(phoneNorm.message);
      return;
    }

    if (
      draft.linkExistingProfileId &&
      draft.lookupConfirmedPhone === phoneNorm.e164
    ) {
      patch({ step: 1 });
      return;
    }

    setLookupPending(true);
    try {
      const formData = new FormData();
      formData.set("phone", draft.identity.phone);
      formData.set("email", draft.identity.email);
      const lookupState = await lookupExistingCustomerAction({}, formData);

      if (lookupState.error) {
        setStepError(lookupState.error);
        return;
      }

      const result = lookupState.result ?? { found: false };
      if (result.found) {
        setLookupMatch(result);
        setLookupModalOpen(true);
        return;
      }

      patch({
        linkExistingProfileId: null,
        lookupConfirmedPhone: null,
        step: 1,
      });
    } finally {
      setLookupPending(false);
    }
  };

  const goNext = () => {
    if (draft.step === 0) {
      void advanceFromIdentityStep();
      return;
    }

    const formName = INTAKE_STEP_FORM[draft.step];
    if (draft.step === 2 && !hasValidOnboardBodyMetrics(draft.health)) {
      setStepError("Height (cm) and weight (kg) are required.");
      return;
    }
    if (formName && questionDefinitions) {
      if (
        !validateQuestionnaireSection(
          questionDefinitions,
          formName,
          draft.questionnaireAnswers,
          memberQuestionContext,
        )
      ) {
        setStepError(`Complete all required fields in “${SECTION_COPY[formName].title}”.`);
        return;
      }
    }
    setStepError(null);
    if (!stepValid) {
      if (draft.step === 0 && !draft.identity.gender) {
        setStepError("Please select a gender before continuing.");
      } else if (draft.step === 2 && !hasValidOnboardBodyMetrics(draft.health)) {
        setStepError("Height (cm) and weight (kg) are required.");
      }
      return;
    }
    patch({ step: Math.min(WIZARD_REVIEW_STEP, draft.step + 1) });
  };

  const goBack = () => {
    if (draft.step === 0) {
      router.push(ROUTES.dashboardCustomers);
      return;
    }
    patch({ step: Math.max(0, draft.step - 1) });
  };

  const stepTitles = [
    {
      title: draft.linkExistingProfileId ? "Returning member" : "Identity",
      subtitle: draft.linkExistingProfileId
        ? "We've loaded their saved details. Check everything looks right, update anything that's changed, then continue."
        : "Who is joining today? Phone is the primary login — email is optional.",
    },
    {
      title: "Membership",
      subtitle: "Pick an outlet and a plan. You can defer plan assignment and log payment later.",
    },
    {
      title: SECTION_COPY.basic_info.title,
      subtitle: draft.linkExistingProfileId
        ? "We've filled in what we know from their last visit — update anything for this branch."
        : "Body metrics plus contact and goals from your outlet’s basic_info questionnaire.",
    },
    {
      title: SECTION_COPY.health_screening.title,
      subtitle: draft.linkExistingProfileId
        ? "Previous health answers are shown — confirm or update if anything has changed."
        : SECTION_COPY.health_screening.description,
    },
    {
      title: SECTION_COPY.diet_preferences.title,
      subtitle: draft.linkExistingProfileId
        ? "Previous diet preferences are shown — update if their goals have changed."
        : SECTION_COPY.diet_preferences.description,
    },
    {
      title: "Review",
      subtitle: draft.linkExistingProfileId
        ? "Double-check their details and new membership at your branch, then save."
        : "Confirm everything before creating the member account.",
    },
  ];

  const currentMeta = stepTitles[draft.step] ?? stepTitles[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={ROUTES.dashboardCustomers}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Customers
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStartFresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Start fresh
          </button>
          <button
            type="button"
            onClick={handleSaveDraftClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <Save className="size-3.5" aria-hidden />
            Save as draft
          </button>
        </div>
      </div>

      {searchParams.get("resume") === "1" && draft.savedAt ? (
        <p className="text-xs text-sky-800 dark:text-sky-200">
          Resuming saved draft ({WIZARD_STEP_LABELS[draft.step] ?? "Identity"}) — edit or use Start fresh for a new customer.
        </p>
      ) : null}

      {draftSavedAt ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Draft saved — visible under Customers → Drafts. Saved at {new Date(draftSavedAt).toLocaleString()}.
        </p>
      ) : null}

      <WizardStepper currentStep={draft.step} />

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950/80">
        <header className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{currentMeta.title}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{currentMeta.subtitle}</p>
        </header>

        {/* Step 0 — Identity */}
        {draft.step === 0 ? (
          <div className="space-y-5">
            {stepError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {stepError}
              </p>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className={labelCn}>Full name</span>
                <input
                  className={inputCn}
                  value={draft.identity.fullName}
                  onChange={(e) => patchIdentity({ fullName: e.target.value })}
                  placeholder="Trisha Sharma"
                  autoComplete="name"
                />
              </label>
              <IndiaPhoneInput
                id="customer-onboard-phone"
                label={draft.linkExistingProfileId ? "Mobile (on file — used for app login)" : "Mobile (primary login)"}
                labelClassName={labelCn}
                inputClassName=""
                value={draft.identity.phone}
                onChange={(localDigits) => patchIdentity({ phone: localDigits })}
                disabled={Boolean(draft.linkExistingProfileId)}
              />
              <label className="block">
                <span className={labelCn}>Email (optional)</span>
                <input
                  className={inputCn}
                  type="email"
                  value={draft.identity.email}
                  onChange={(e) => patchIdentity({ email: e.target.value })}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className={labelCn}>Date of birth</span>
                <input
                  className={inputCn}
                  type="date"
                  value={draft.identity.dateOfBirth}
                  onChange={(e) => patchIdentity({ dateOfBirth: e.target.value })}
                />
              </label>
            </div>
            <div>
              <span className={labelCn}>Gender (required)</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => patchIdentity({ gender: g })}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition",
                      draft.identity.gender === g
                        ? selectedTileCn + " text-orange-800 dark:text-orange-200"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                    )}
                  >
                    {g === "other" ? "Other" : g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Step 1 — Membership */}
        {draft.step === 1 ? (
          <div className="space-y-6">
            {selectedOutletMembershipNotice ? (
              <SameBranchOnboardBanner
                branchName={selectedOutletMembershipNotice.branchName}
                organizationName={selectedOutletMembershipNotice.organizationName}
                isActive={selectedOutletMembershipNotice.isActive}
                status={selectedOutletMembershipNotice.status}
              />
            ) : null}
            <label className="block">
              <span className={labelCn}>Outlet</span>
              <div className="relative mt-1.5">
                <select
                  className={cn(inputCn, "appearance-none pr-10")}
                  value={draft.membership.outletId}
                  onChange={(e) => {
                    patchMembership({ outletId: e.target.value, planId: "", assignedTrainerId: "" });
                  }}
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {outletLabel(o)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              </div>
            </label>

            <div>
              <span className={labelCn}>Plan</span>
              {visiblePlans.length ? (
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {visiblePlans.map((plan) => {
                    const selected = draft.membership.planId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => patchMembership({ planId: plan.id })}
                        className={cn(
                          "rounded-xl border px-4 py-4 text-left transition",
                          selected
                            ? selectedTileCn
                            : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900",
                        )}
                      >
                        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatInrPrice(plan.price, plan.currency)}
                        </p>
                        <p className="mt-0.5 text-sm capitalize text-zinc-600 dark:text-zinc-400">
                          {plan.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">No active plans for this outlet — you can assign one later.</p>
              )}
            </div>

            <label className="block">
              <span className={labelCn}>Membership start date</span>
              <input
                className={inputCn}
                type="date"
                value={draft.membership.startDate}
                onChange={(e) => patchMembership({ startDate: e.target.value })}
              />
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <input
                type="checkbox"
                checked={draft.membership.logPaymentNow}
                onChange={(e) => patchMembership({ logPaymentNow: e.target.checked })}
                className="size-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-zinc-800 dark:text-zinc-200">
                Log {selectedPlan ? formatInrPrice(selectedPlan.price, selectedPlan.currency) : "plan"} payment now
              </span>
            </label>
          </div>
        ) : null}

        {/* Step 2 — Basic Info (vitals + basic_info questions) */}
        {draft.step === 2 ? (
          <div className="space-y-4">
            {stepError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {stepError}
              </p>
            ) : null}
            {draft.membership.outletId ? (
              <WizardFormQuestionsStep
                outletId={draft.membership.outletId}
                formName={ONBOARDING_FORM.basic}
                memberGender={draft.identity.gender}
                answers={draft.questionnaireAnswers.basic_info ?? {}}
                onSectionChange={onQuestionnaireSectionChange}
                headerSlot={
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelCn}>Height (cm) (required)</span>
                      <input
                        className={inputCn}
                        type="number"
                        min={50}
                        max={280}
                        step={0.1}
                        value={draft.health.heightCm}
                        onChange={(e) => patchHealth({ heightCm: e.target.value })}
                        placeholder="175"
                      />
                    </label>
                    <label className="block">
                      <span className={labelCn}>Weight (kg) (required)</span>
                      <input
                        className={inputCn}
                        type="number"
                        min={20}
                        max={400}
                        step={0.1}
                        value={draft.health.weightKg}
                        onChange={(e) => patchHealth({ weightKg: e.target.value })}
                        placeholder="72.5"
                      />
                    </label>
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900/60">
                      <div className={cn("h-1.5 w-full", bmiTone.bar)} aria-hidden />
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", bmiTone.chip)}>
                          {bmiBand ? BMI_BAND_LABEL[bmiBand] : "BMI"}
                        </span>
                        <span className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {bmi != null ? bmi.toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              />
            ) : (
              <p className="text-sm text-zinc-600">Pick an outlet on the Membership step first.</p>
            )}
          </div>
        ) : null}

        {/* Step 3 — Health Screening */}
        {draft.step === 3 ? (
          <div className="space-y-4">
            {stepError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {stepError}
              </p>
            ) : null}
            {draft.membership.outletId ? (
              <WizardFormQuestionsStep
                outletId={draft.membership.outletId}
                formName={ONBOARDING_FORM.health}
                memberGender={draft.identity.gender}
                answers={draft.questionnaireAnswers.health_screening ?? {}}
                onSectionChange={onQuestionnaireSectionChange}
              />
            ) : (
              <p className="text-sm text-zinc-600">Pick an outlet on the Membership step first.</p>
            )}
          </div>
        ) : null}

        {/* Step 4 — Diet Preferences */}
        {draft.step === 4 ? (
          <div className="space-y-4">
            {stepError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {stepError}
              </p>
            ) : null}
            {draft.membership.outletId ? (
              <WizardFormQuestionsStep
                outletId={draft.membership.outletId}
                formName={ONBOARDING_FORM.diet}
                memberGender={draft.identity.gender}
                answers={draft.questionnaireAnswers.diet_preferences ?? {}}
                onSectionChange={onQuestionnaireSectionChange}
              />
            ) : (
              <p className="text-sm text-zinc-600">Pick an outlet on the Membership step first.</p>
            )}
          </div>
        ) : null}

        {/* Step 5 — Review */}
        {draft.step === 5 ? (
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="outlet_id" value={draft.membership.outletId} />
            <input type="hidden" name="plan_id" value={draft.membership.planId} />
            <input type="hidden" name="start_date" value={draft.membership.startDate} />
            {draft.membership.logPaymentNow && draft.membership.planId ? (
              <input type="hidden" name="record_offline_payment" value="on" />
            ) : null}
            <input type="hidden" name="full_name" value={draft.identity.fullName} />
            <input type="hidden" name="phone" value={draft.identity.phone} />
            <input type="hidden" name="email" value={draft.identity.email} />
            {draft.linkExistingProfileId ? (
              <input type="hidden" name="existing_profile_id" value={draft.linkExistingProfileId} />
            ) : null}
            <input type="hidden" name="date_of_birth" value={draft.identity.dateOfBirth} />
            <input type="hidden" name="gender" value={draft.identity.gender} />
            <input type="hidden" name="height_cm" value={draft.health.heightCm} />
            <input type="hidden" name="weight_kg" value={draft.health.weightKg} />
            {draft.membership.assignedTrainerId ? (
              <input type="hidden" name="trainer_profile_id" value={draft.membership.assignedTrainerId} />
            ) : null}
            <input
              type="hidden"
              name="questionnaire_payload_json"
              value={JSON.stringify(
                buildQuestionnairePayload(
                  questionDefinitions,
                  draft.questionnaireAnswers,
                  memberQuestionContext,
                ),
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Identity</h3>
                <dl className="mt-2">
                  <ReviewRow label="Name" value={draft.identity.fullName} />
                  <ReviewRow label="Mobile" value={formatPhoneDisplay(draft.identity.phone)} />
                  <ReviewRow label="Email" value={draft.identity.email || "—"} />
                  <ReviewRow label="DOB" value={draft.identity.dateOfBirth || "—"} />
                  <ReviewRow label="Gender" value={draft.identity.gender ? genderLabel(draft.identity.gender) : "—"} />
                </dl>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Membership</h3>
                <dl className="mt-2">
                  <ReviewRow
                    label="Outlet"
                    value={
                      outletLabel(
                        outlets.find((o) => o.id === draft.membership.outletId) ?? {
                          id: "",
                          name: "—",
                          city: null,
                          organization_id: "",
                          organization_name: null,
                        },
                      )
                    }
                  />
                  <ReviewRow label="Plan" value={selectedPlan?.name ?? "Deferred"} />
                  <ReviewRow label="Start" value={draft.membership.startDate} />
                  <ReviewRow label="Payment" value={draft.membership.logPaymentNow ? "Log now" : "Later"} />
                  <ReviewRow
                    label="Coach"
                    value={selectedTrainer ? trainerDisplayLabel(selectedTrainer) : "Not assigned"}
                  />
                </dl>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{SECTION_COPY.basic_info.title}</h3>
                <dl className="mt-2">
                  <ReviewRow label="Height" value={draft.health.heightCm ? `${draft.health.heightCm} cm` : "—"} />
                  <ReviewRow label="Weight" value={draft.health.weightKg ? `${draft.health.weightKg} kg` : "—"} />
                  <ReviewRow label="BMI" value={bmi != null ? `${bmi.toFixed(1)} (${bmiBand ? BMI_BAND_LABEL[bmiBand] : "—"})` : "—"} />
                  {(applicableQuestionDefinitions?.basic_info ?? []).map((def) => (
                    <ReviewRow
                      key={def.id}
                      label={def.label}
                      value={formatAnswerPreview(def, draft.questionnaireAnswers.basic_info?.[def.question_key])}
                    />
                  ))}
                </dl>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{SECTION_COPY.health_screening.title}</h3>
                <dl className="mt-2">
                  {(applicableQuestionDefinitions?.health_screening ?? []).length ? (
                    applicableQuestionDefinitions!.health_screening.map((def) => (
                      <ReviewRow
                        key={def.id}
                        label={def.label}
                        value={formatAnswerPreview(def, draft.questionnaireAnswers.health_screening?.[def.question_key])}
                      />
                    ))
                  ) : (
                    <ReviewRow label="Questions" value="None configured" />
                  )}
                </dl>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 sm:col-span-2 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{SECTION_COPY.diet_preferences.title}</h3>
                <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
                  {(applicableQuestionDefinitions?.diet_preferences ?? []).length ? (
                    applicableQuestionDefinitions!.diet_preferences.map((def) => (
                      <ReviewRow
                        key={def.id}
                        label={def.label}
                        value={formatAnswerPreview(def, draft.questionnaireAnswers.diet_preferences?.[def.question_key])}
                      />
                    ))
                  ) : (
                    <ReviewRow label="Questions" value="None configured" />
                  )}
                </dl>
              </div>
            </div>

            {canAssignTrainer && outletTrainers.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
                <label className="block">
                  <span className={labelCn}>Assign coach (optional)</span>
                  <TrainerSelectField
                    trainers={outletTrainers}
                    value={draft.membership.assignedTrainerId}
                    onChange={(id) => patchMembership({ assignedTrainerId: id })}
                    emptyLabel="No coach yet — assign later from the roster"
                  />
                </label>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Coaches only see members assigned to them. You can also assign from the customer list.
                </p>
              </div>
            ) : null}

            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
              {draft.linkExistingProfileId
                ? "You're adding a returning member to this branch. Any updates you made will be saved when you finish."
                : contactCopy.blurb}
            </p>

            {state.error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
                {state.error}
              </p>
            ) : null}

            <div className="flex items-center justify-between border-t border-zinc-100 pt-6 dark:border-zinc-800">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <Button type="submit" disabled={pending} size="lg" className="rounded-xl">
                {pending
                  ? "Saving…"
                  : draft.linkExistingProfileId
                    ? selectedOutletMembershipNotice
                      ? "Save updated details"
                      : "Link member to branch"
                    : "Create customer"}
              </Button>
            </div>
          </form>
        ) : null}

        {/* Footer nav for steps before Review */}
        {draft.step < WIZARD_REVIEW_STEP ? (
          <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            >
              <ArrowLeft className="size-4" />
              {draft.step === 0 ? "Cancel" : "Back"}
            </button>
            <Button
              type="button"
              onClick={goNext}
              disabled={!stepValid || lookupPending}
              size="lg"
              className="rounded-xl"
            >
              {lookupPending ? "Checking…" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <ExistingCustomerLinkDialog
        open={lookupModalOpen}
        customer={lookupMatch}
        staffOrganizationIds={staffOrganizationIds}
        staffOutlets={outlets}
        pending={lookupPending}
        onConfirmLink={() => {
          if (lookupMatch) void applyExistingCustomerToDraft(lookupMatch);
        }}
        onDifferentPerson={() => {
          setLookupModalOpen(false);
          setLookupMatch(null);
          setLinkedGymHistory([]);
          setStepError("Use a different mobile number if this is not the same person.");
        }}
        onClose={() => {
          setLookupModalOpen(false);
          setLookupMatch(null);
        }}
      />
    </div>
  );
}

/** @deprecated Use `CustomerOnboardWizard` — kept for imports that haven't migrated yet. */
export const AddCustomerOnboardWizard = CustomerOnboardWizard;
