"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, X } from "lucide-react";
import {
  assignTrainerToMembershipAction,
  suspendMembershipAction,
  updateCustomerProfileAction,
  type SimpleActionState,
} from "@/app/admin/customers/actions";
import { MembershipAssignPlanPanel } from "@/components/admin/MembershipAssignPlanPanel";
import { CustomerProgramPlansPanel } from "@/components/dashboard/CustomerProgramPlansPanel";
import { ReviewCard, ReviewRow } from "@/components/dashboard/customer-onboard/ReviewRow";
import { WizardStepper } from "@/components/dashboard/customer-onboard/WizardStepper";
import { Button } from "@/components/ui/button";
import { ONBOARDING_FORM, SECTION_COPY } from "@/features/onboarding/constants";
import { FormSectionCard } from "@/features/onboarding/components/FormSectionCard";
import { formatAnswerPreview } from "@/features/onboarding/format-answer-preview";
import { useOnboardingFormsBundle } from "@/features/onboarding/hooks/useOnboardingForms";
import { canEditOnboardingSection, canViewOnboardingSection } from "@/features/onboarding/permissions";
import { filterDefinitionBundleForMember, filterQuestionDefinitions } from "@/features/onboarding/question-visibility";
import type { OnboardingFormName, OnboardingViewerContext } from "@/features/onboarding/types";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import type { UserRole } from "@/lib/auth/roles";
import {
  canAssignDedicatedTrainer,
  canEditCustomerProfileFields,
  canSuspendMembership,
  MEMBERSHIP_CATALOG_EDITOR_ROLES,
  ROLES,
} from "@/lib/auth/roles";
import { customerMemberContactCopy } from "@/lib/auth/role-sign-in-policy";
import { BMI_BAND_LABEL, bmiBandTone, classifyBmi } from "@/lib/customers/bmi-band";
import {
  parseProfileSection,
  profileSectionSlug,
  WIZARD_REVIEW_STEP,
  WIZARD_STEP_LABELS,
} from "@/lib/customers/customer-onboard-draft";
import { trainerDisplayLabel } from "@/lib/admin/outlet-trainers";
import type { CustomerMembershipDetailMembership, TrainerLite } from "@/lib/customers/membership-detail";
import type { CustomerProgramPlansSnapshot } from "@/lib/customers/customer-program-plans";
import { formatInrPrice } from "@/lib/customers/format-inr";
import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";
import {
  computeBmiFromMetrics,
  formatBmi,
  formatDateOfBirth,
  formatHeightCm,
  formatWeightKg,
  genderForIntakeForm,
  genderLabel,
  MEMBER_INTAKE_GENDER_OPTIONS,
} from "@/lib/profile/vitals";
import { cn } from "@/lib/utils/cn";

export type { CustomerMembershipDetailMembership, TrainerLite };

const INTAKE_STEP_FORM: Record<number, OnboardingFormName> = {
  2: ONBOARDING_FORM.basic,
  3: ONBOARDING_FORM.health,
  4: ONBOARDING_FORM.diet,
};

const labelCn = "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const inputCn =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-sm text-zinc-900 outline-none ring-orange-500/25 transition focus:border-orange-500 focus:bg-white focus:ring-4 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:focus:bg-zinc-950";

function readableStatus(status: string): string {
  const map: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    expired: "Expired",
    pending: "Pending",
  };
  return map[status] ?? status;
}

const STEP_META = [
  { title: "Identity", subtitle: "Contact details and demographics on the member profile." },
  { title: "Membership", subtitle: "Branch pass, catalogue plan, coach, and matched exercise/diet programs." },
  {
    title: SECTION_COPY.basic_info.title,
    subtitle: "Body metrics plus outlet basic_info questionnaire responses.",
  },
  { title: SECTION_COPY.health_screening.title, subtitle: SECTION_COPY.health_screening.description },
  { title: SECTION_COPY.diet_preferences.title, subtitle: SECTION_COPY.diet_preferences.description },
  { title: "Review", subtitle: "Full snapshot plus coach assignment and account controls." },
] as const;

/**
 * Unified customer profile — same stepper + review cards as the add-customer wizard.
 *
 * **Reuse:** `WizardStepper`, `ReviewRow`/`ReviewCard`, `FormSectionCard` (flat variant for edits).
 * **Moderation:** replace legacy `MembershipProfileTabs` + `CustomerMembershipDetail` overview stack.
 */
export function CustomerMembershipWorkspace(props: {
  membership: CustomerMembershipDetailMembership;
  catalogue: MembershipPlanAdminRow[];
  defaultStartDate: string;
  ctxRole: UserRole;
  trainers: TrainerLite[];
  canAssignPlan: boolean;
  canAssignTrainer: boolean;
  canAssignProgramPlans: boolean;
  canViewProgramPlans: boolean;
  programPlans: CustomerProgramPlansSnapshot;
  viewer: OnboardingViewerContext;
  /** Base path for `?section=` sync, e.g. `/dashboard/customers/[id]`. */
  basePath: string;
}) {
  const {
    membership,
    catalogue,
    defaultStartDate,
    ctxRole,
    trainers,
    canAssignPlan,
    canAssignTrainer,
    canAssignProgramPlans,
    canViewProgramPlans,
    programPlans,
    viewer,
    basePath,
  } = props;

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = parseProfileSection(searchParams.get("section"));
  const [step, setStep] = useState(initialStep);
  const [editing, setEditing] = useState(false);
  /** Section-level save feedback — survives router.refresh during composite saves. */
  const [sectionFeedback, setSectionFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(
    null,
  );
  const lastSectionSlugRef = useRef(searchParams.get("section"));

  const outletLabel = [membership.outlet?.name, membership.outlet?.city].filter(Boolean).join(" · ");
  const cataloguePlan = catalogue.find((p) => p.id === membership.plan?.id) ?? null;
  const planPriceLabel = cataloguePlan
    ? `${cataloguePlan.name} · ${formatInrPrice(cataloguePlan.price, cataloguePlan.currency)}`
    : membership.plan?.name ?? "None";

  const bmi =
    membership.profile?.bmi ??
    computeBmiFromMetrics(membership.profile?.height_cm ?? null, membership.profile?.weight_kg ?? null);
  const bmiBand = bmi != null ? classifyBmi(bmi) : null;
  const bmiTone = bmiBandTone(bmiBand);

  const { mergedDefinitions, bundledResponses, isLoading, error } = useOnboardingFormsBundle(
    membership.profile_id,
    membership.outlet_id,
  );

  const goToStep = useCallback(
    (next: number) => {
      const clamped = Math.min(WIZARD_REVIEW_STEP, Math.max(0, next));
      setStep(clamped);
      setEditing(false);
      setSectionFeedback(null);
      const slug = profileSectionSlug(clamped);
      router.replace(`${basePath}?section=${slug}`, { scroll: false });
    },
    [basePath, router],
  );

  useEffect(() => {
    const slug = searchParams.get("section");
    const fromUrl = parseProfileSection(slug);
    setStep(fromUrl);
    // Only exit edit when the user navigates to a different section — not on router.refresh().
    if (slug !== lastSectionSlugRef.current) {
      lastSectionSlugRef.current = slug;
      setEditing(false);
      setSectionFeedback(null);
    }
  }, [searchParams]);

  const canEditCurrentStep = useMemo(() => {
    if (step === WIZARD_REVIEW_STEP) return false;
    if (step === 0) return canEditCustomerProfileFields(ctxRole);
    if (step === 1) return canAssignPlan || canAssignTrainer;
    const formName = INTAKE_STEP_FORM[step];
    if (formName) {
      const canQ = canEditOnboardingSection(ctxRole, formName);
      if (step === 2) return canEditCustomerProfileFields(ctxRole) || canQ;
      return canQ;
    }
    return false;
  }, [step, ctxRole, canAssignPlan, canAssignTrainer]);

  const meta = STEP_META[step] ?? STEP_META[0];

  return (
    <div className="space-y-6">
      <WizardStepper currentStep={step} onStepClick={goToStep} />

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950/80">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{meta.title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{meta.subtitle}</p>
          </div>
          {canEditCurrentStep ? (
            editing ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
                <X className="size-3.5" aria-hidden />
                Cancel edit
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => { setSectionFeedback(null); setEditing(true); }} className="gap-1.5">
                <Pencil className="size-3.5" aria-hidden />
                Edit section
              </Button>
            )
          ) : null}
        </header>

        {step === 0 ? (
          editing ? (
            <IdentityEditForm membership={membership} onSaved={() => setEditing(false)} />
          ) : (
            <ReviewCard title="Identity">
              <ReviewRow label="Name" value={membership.profile?.full_name ?? "—"} />
              <ReviewRow label="Mobile" value={membership.profile?.phone ?? "—"} />
              <ReviewRow label="Email" value={membership.profile?.email ?? "—"} />
              <ReviewRow label="DOB" value={formatDateOfBirth(membership.profile?.date_of_birth)} />
              <ReviewRow label="Gender" value={genderLabel(membership.profile?.gender)} />
            </ReviewCard>
          )
        ) : null}

        {step === 1 ? (
          editing ? (
            <MembershipEditPanels
              membership={membership}
              catalogue={catalogue}
              defaultStartDate={defaultStartDate}
              canAssignPlan={canAssignPlan}
              canAssignTrainer={canAssignTrainer}
              trainers={trainers}
              outletLabel={outletLabel}
              ctxRole={ctxRole}
              onDone={() => setEditing(false)}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <ReviewCard title="Membership">
                  <ReviewRow label="Branch" value={outletLabel || "—"} />
                  <ReviewRow label="Pass status" value={readableStatus(membership.status)} />
                  <ReviewRow label="Plan" value={planPriceLabel} />
                  <ReviewRow
                    label="Current term"
                    value={`${membership.start_date ?? "—"} → ${membership.end_date ?? "Open-ended"}`}
                  />
                  <ReviewRow
                    label="Last payment"
                    value={
                      membership.amount_paid != null
                        ? formatInrPrice(membership.amount_paid, membership.currency ?? "INR")
                        : "—"
                    }
                  />
                  <ReviewRow
                    label="Coach"
                    value={
                      membership.assigned_trainer_id
                        ? trainerDisplayLabel(trainers.find((t) => t.id === membership.assigned_trainer_id))
                        : "Not assigned"
                    }
                  />
                </ReviewCard>
                <ReviewCard title="Record trail">
                  <ReviewRow label="Joined" value={formatMembershipTimestampUtcLabel(membership.joined_at)} />
                  <ReviewRow
                    label="Onboarded by"
                    value={
                      membership.audit.onboardedByLegacyOnly
                        ? `${membership.audit.onboardedByLabel} (legacy)`
                        : membership.audit.onboardedByLabel
                    }
                  />
                  <ReviewRow label="Last updated by" value={membership.audit.lastUpdatedByLabel} />
                  <ReviewRow
                    label="Last updated"
                    value={formatMembershipTimestampUtcLabel(membership.audit.updatedAt)}
                  />
                </ReviewCard>
              </div>
              {canViewProgramPlans ? (
                <CustomerProgramPlansPanel
                  membershipId={membership.id}
                  profileId={membership.profile_id}
                  outletId={membership.outlet_id}
                  memberName={membership.profile?.full_name ?? "Member"}
                  snapshot={programPlans}
                  canAssign={canAssignProgramPlans}
                />
              ) : null}
            </div>
          )
        ) : null}

        {step >= 2 && step <= 4 ? (
          <IntakeSectionPanel
            step={step}
            editing={editing}
            membership={membership}
            viewer={viewer}
            ctxRole={ctxRole}
            mergedDefinitions={mergedDefinitions}
            bundledResponses={bundledResponses}
            isLoading={isLoading}
            error={error}
            bmi={bmi}
            bmiBand={bmiBand}
            bmiTone={bmiTone}
            sectionFeedback={sectionFeedback}
            onSectionFeedback={setSectionFeedback}
            onSaved={() => setEditing(false)}
          />
        ) : null}

        {step === WIZARD_REVIEW_STEP ? (
          <ReviewTabContent
            membership={membership}
            outletLabel={outletLabel}
            planPriceLabel={planPriceLabel}
            mergedDefinitions={mergedDefinitions}
            bundledResponses={bundledResponses}
            isLoading={isLoading}
            bmi={bmi}
            bmiBand={bmiBand}
            catalogue={catalogue}
            defaultStartDate={defaultStartDate}
            canAssignPlan={canAssignPlan}
            canAssignTrainer={canAssignTrainer}
            canAssignProgramPlans={canAssignProgramPlans}
            canViewProgramPlans={canViewProgramPlans}
            programPlans={programPlans}
            canSuspend={canSuspendMembership(ctxRole)}
            trainers={trainers}
            ctxRole={ctxRole}
            onJumpToStep={goToStep}
          />
        ) : null}
      </div>
    </div>
  );
}

function IdentityEditForm(props: {
  membership: CustomerMembershipDetailMembership;
  onSaved: () => void;
}) {
  const { membership, onSaved } = props;
  const router = useRouter();
  const memberContactCopy = customerMemberContactCopy();
  const [state, action, pending] = useActionState(updateCustomerProfileAction, {} as SimpleActionState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onSaved();
    }
  }, [state.success, router, onSaved]);

  const p = membership.profile;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="profile_id" value={membership.profile_id} />
      <input type="hidden" name="membership_outlet_id" value={membership.outlet_id} />
      <input type="hidden" name="membership_id_for_revalidate" value={membership.id} />
      <input type="hidden" name="height_cm" value={p?.height_cm != null ? String(p.height_cm) : ""} />
      <input type="hidden" name="weight_kg" value={p?.weight_kg != null ? String(p.weight_kg) : ""} />

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={labelCn}>Full name</span>
          <input name="full_name" className={inputCn} defaultValue={p?.full_name ?? ""} autoComplete="name" />
        </label>
        <label className="block">
          <span className={labelCn}>Mobile</span>
          <input name="phone" className={inputCn} type="tel" defaultValue={p?.phone ?? ""} autoComplete="tel" />
        </label>
        <label className="block">
          <span className={labelCn}>{memberContactCopy.emailLabel}</span>
          <input
            name="email"
            className={inputCn}
            type="email"
            defaultValue={p?.email ?? ""}
            placeholder="Leave blank if phone-only"
          />
        </label>
        <label className="block">
          <span className={labelCn}>Date of birth</span>
          <input name="date_of_birth" className={inputCn} type="date" defaultValue={p?.date_of_birth ?? ""} />
        </label>
      </div>
      <label className="block">
        <span className={labelCn}>
          Gender <span className="text-rose-600 dark:text-rose-400">*</span>
        </span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {MEMBER_INTAKE_GENDER_OPTIONS.map((o) => {
            const selected = genderForIntakeForm(p?.gender) === o.value;
            return (
              <label
                key={o.value}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition",
                  selected
                    ? "border-orange-600 bg-orange-50 text-orange-800 dark:border-orange-500 dark:bg-orange-950/40 dark:text-orange-200"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                )}
              >
                <input type="radio" name="gender" value={o.value} defaultChecked={selected} className="sr-only" />
                {o.label}
              </label>
            );
          })}
        </div>
      </label>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{state.success}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save identity"}
      </Button>
    </form>
  );
}

function VitalsOnlyEditForm(props: {
  membership: CustomerMembershipDetailMembership;
  heightCm: string;
  weightKg: string;
  onSaved: () => void;
}) {
  const { membership, heightCm, weightKg, onSaved } = props;
  const router = useRouter();
  const [state, action, pending] = useActionState(updateCustomerProfileAction, {} as SimpleActionState);
  const p = membership.profile;

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onSaved();
    }
  }, [state.success, router, onSaved]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profile_id" value={membership.profile_id} />
      <input type="hidden" name="membership_outlet_id" value={membership.outlet_id} />
      <input type="hidden" name="membership_id_for_revalidate" value={membership.id} />
      <input type="hidden" name="full_name" value={p?.full_name ?? ""} />
      <input type="hidden" name="phone" value={p?.phone ?? ""} />
      <input type="hidden" name="email" value={p?.email ?? ""} />
      <input type="hidden" name="date_of_birth" value={p?.date_of_birth ?? ""} />
      <input type="hidden" name="gender" value={p?.gender ?? ""} />
      <input type="hidden" name="height_cm" value={heightCm} />
      <input type="hidden" name="weight_kg" value={weightKg} />
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save section"}
      </Button>
    </form>
  );
}

function MembershipEditPanels(props: {
  membership: CustomerMembershipDetailMembership;
  catalogue: MembershipPlanAdminRow[];
  defaultStartDate: string;
  canAssignPlan: boolean;
  canAssignTrainer: boolean;
  trainers: TrainerLite[];
  outletLabel: string;
  ctxRole: UserRole;
  onDone: () => void;
}) {
  const {
    membership,
    catalogue,
    defaultStartDate,
    canAssignPlan,
    canAssignTrainer,
    trainers,
    outletLabel,
    ctxRole,
  } = props;

  const router = useRouter();
  const [trainerState, trainerAction, trainerPending] = useActionState(assignTrainerToMembershipAction, {} as SimpleActionState);

  useEffect(() => {
    if (trainerState.success) router.refresh();
  }, [trainerState.success, router]);

  return (
    <div className="space-y-6">
      {canAssignPlan ? (
        <MembershipAssignPlanPanel
          membershipId={membership.id}
          outletDisplay={outletLabel.length ? outletLabel : membership.outlet_id}
          status={membership.status}
          profileLabel={membership.profile?.full_name ?? "Member"}
          plans={catalogue}
          defaultStartDate={defaultStartDate}
        />
      ) : ctxRole === ROLES.TRAINER ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Coaches can train assigned members; changing plans stays with front desk and branch leads.
        </p>
      ) : null}

      {canAssignTrainer ? (
        <form action={trainerAction} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Coach assignment</p>
          <input type="hidden" name="membership_id" value={membership.id} />
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Trainer
            <select
              name="trainer_profile_id"
              defaultValue={membership.assigned_trainer_id ?? ""}
              className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Not assigned</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name ?? t.email ?? t.id}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={trainerPending} variant="secondary">
            {trainerPending ? "Saving…" : "Save coach"}
          </Button>
          {trainerState.error ? <p className="text-sm text-rose-600">{trainerState.error}</p> : null}
          {trainerState.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{trainerState.success}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

function IntakeSectionPanel(props: {
  step: number;
  editing: boolean;
  membership: CustomerMembershipDetailMembership;
  viewer: OnboardingViewerContext;
  ctxRole: UserRole;
  mergedDefinitions: ReturnType<typeof useOnboardingFormsBundle>["mergedDefinitions"];
  bundledResponses: ReturnType<typeof useOnboardingFormsBundle>["bundledResponses"];
  isLoading: boolean;
  error: unknown;
  bmi: number | null;
  bmiBand: ReturnType<typeof classifyBmi>;
  bmiTone: ReturnType<typeof bmiBandTone>;
  sectionFeedback: { kind: "error" | "success"; message: string } | null;
  onSectionFeedback: (feedback: { kind: "error" | "success"; message: string } | null) => void;
  onSaved: () => void;
}) {
  const {
    step,
    editing,
    membership,
    viewer,
    ctxRole,
    mergedDefinitions,
    bundledResponses,
    isLoading,
    error,
    bmi,
    bmiBand,
    bmiTone,
    sectionFeedback,
    onSectionFeedback,
    onSaved,
  } = props;

  const router = useRouter();
  const formName = INTAKE_STEP_FORM[step];
  const canEditVitals = step === 2 && canEditCustomerProfileFields(ctxRole);
  const p = membership.profile;
  const [heightCm, setHeightCm] = useState(p?.height_cm != null ? String(p.height_cm) : "");
  const [weightKg, setWeightKg] = useState(p?.weight_kg != null ? String(p.weight_kg) : "");
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sectionFeedback && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [sectionFeedback]);

  useEffect(() => {
    setHeightCm(p?.height_cm != null ? String(p.height_cm) : "");
    setWeightKg(p?.weight_kg != null ? String(p.weight_kg) : "");
  }, [p?.height_cm, p?.weight_kg, editing]);

  if (!formName) return null;

  if (!canViewOnboardingSection(ctxRole, formName)) {
    return <p className="text-sm text-zinc-600">Your role cannot view this section.</p>;
  }

  if (error) {
    const msg = error instanceof Error ? error.message : "Unable to load questionnaire.";
    return <p className="text-sm text-rose-600">{msg}</p>;
  }

  if (isLoading && !mergedDefinitions) {
    return <p className="text-sm text-zinc-500">Loading intake responses…</p>;
  }

  const defs = mergedDefinitions?.[formName] ?? [];
  const memberGender = membership.profile?.gender ?? null;
  const applicableDefs = filterQuestionDefinitions(defs, { gender: memberGender });
  const answers = bundledResponses?.[formName]?.answers_json ?? {};
  const copy = SECTION_COPY[formName];

  const feedbackBanner = sectionFeedback ? (
    <div
      ref={feedbackRef}
      role="alert"
      className={cn(
        "rounded-xl border-2 px-4 py-3 text-sm font-medium",
        sectionFeedback.kind === "error"
          ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-600 dark:bg-rose-950/50 dark:text-rose-100"
          : "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100",
      )}
    >
      {sectionFeedback.message}
    </div>
  ) : null;

  if (editing) {
    const saveVitalsBeforeQuestionnaire = canEditVitals
      ? async (): Promise<{ error?: string } | void> => {
          const formData = new FormData();
          formData.set("profile_id", membership.profile_id);
          formData.set("membership_outlet_id", membership.outlet_id);
          formData.set("membership_id_for_revalidate", membership.id);
          formData.set("skip_revalidate", "1");
          formData.set("full_name", p?.full_name ?? "");
          formData.set("phone", p?.phone ?? "");
          formData.set("email", p?.email ?? "");
          formData.set("date_of_birth", p?.date_of_birth ?? "");
          formData.set("gender", p?.gender ?? "");
          formData.set("height_cm", heightCm);
          formData.set("weight_kg", weightKg);
          const result = await updateCustomerProfileAction({}, formData);
          if (result.error) return { error: result.error };
        }
      : undefined;

    return (
      <div className="space-y-6">
        {feedbackBanner}
        {step === 2 && canEditVitals ? (
          <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Body metrics</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className={labelCn}>
                  Height (cm) <span className="text-rose-600 dark:text-rose-400">*</span>
                </span>
                <input
                  name="height_cm"
                  className={inputCn}
                  type="number"
                  min={50}
                  max={280}
                  step={0.1}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelCn}>
                  Weight (kg) <span className="text-rose-600 dark:text-rose-400">*</span>
                </span>
                <input
                  name="weight_kg"
                  className={inputCn}
                  type="number"
                  min={20}
                  max={400}
                  step={0.1}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}
        {canEditOnboardingSection(ctxRole, formName) ? (
          <FormSectionCard
            variant="flat"
            formName={formName}
            title={copy.title}
            description={copy.description}
            definitions={defs}
            memberGender={memberGender}
            bundledResponse={bundledResponses?.[formName] ?? null}
            viewer={viewer}
            outletId={membership.outlet_id}
            onSaved={() => {
              router.refresh();
              onSaved();
            }}
            onFeedback={onSectionFeedback}
            beforeFlatSave={saveVitalsBeforeQuestionnaire}
          />
        ) : canEditVitals ? (
          <VitalsOnlyEditForm
            membership={membership}
            heightCm={heightCm}
            weightKg={weightKg}
            onSaved={onSaved}
          />
        ) : (
          <p className="text-sm text-zinc-600">This section is read-only for your role.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackBanner}
      <ReviewCard title={copy.title} className={step === 4 ? "sm:col-span-2" : undefined}>
      {step === 2 ? (
        <>
          <ReviewRow label="Height" value={formatHeightCm(membership.profile?.height_cm)} />
          <ReviewRow label="Weight" value={formatWeightKg(membership.profile?.weight_kg)} />
          <ReviewRow
            label="BMI"
            value={
              bmi != null
                ? `${formatBmi(bmi)}${bmiBand ? ` (${BMI_BAND_LABEL[bmiBand]})` : ""}`
                : "—"
            }
          />
          {bmiBand ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className={cn("h-1 w-full", bmiTone.bar)} aria-hidden />
            </div>
          ) : null}
        </>
      ) : null}
      {applicableDefs.length ? (
        applicableDefs.map((def) => (
          <ReviewRow
            key={def.id}
            label={def.label}
            value={formatAnswerPreview(def, (answers as Record<string, unknown>)[def.question_key])}
          />
        ))
      ) : (
        <ReviewRow label="Questions" value="None configured for this outlet" />
      )}
      </ReviewCard>
    </div>
  );
}

function ReviewTabContent(props: {
  membership: CustomerMembershipDetailMembership;
  outletLabel: string;
  planPriceLabel: string;
  mergedDefinitions: ReturnType<typeof useOnboardingFormsBundle>["mergedDefinitions"];
  bundledResponses: ReturnType<typeof useOnboardingFormsBundle>["bundledResponses"];
  isLoading: boolean;
  bmi: number | null;
  bmiBand: ReturnType<typeof classifyBmi>;
  catalogue: MembershipPlanAdminRow[];
  defaultStartDate: string;
  canAssignPlan: boolean;
  canAssignTrainer: boolean;
  canAssignProgramPlans: boolean;
  canViewProgramPlans: boolean;
  programPlans: CustomerProgramPlansSnapshot;
  canSuspend: boolean;
  trainers: TrainerLite[];
  ctxRole: UserRole;
  onJumpToStep: (step: number) => void;
}) {
  const {
    membership,
    outletLabel,
    planPriceLabel,
    mergedDefinitions,
    bundledResponses,
    isLoading,
    bmi,
    bmiBand,
    catalogue,
    defaultStartDate,
    canAssignPlan,
    canAssignTrainer,
    canAssignProgramPlans,
    canViewProgramPlans,
    programPlans,
    canSuspend,
    trainers,
    ctxRole,
    onJumpToStep,
  } = props;

  const router = useRouter();
  const [suspendState, suspendAction, suspendPending] = useActionState(suspendMembershipAction, {} as SimpleActionState);

  useEffect(() => {
    if (suspendState.success) router.refresh();
  }, [suspendState.success, router]);

  const basicAnswers = bundledResponses?.basic_info?.answers_json ?? {};
  const healthAnswers = bundledResponses?.health_screening?.answers_json ?? {};
  const dietAnswers = bundledResponses?.diet_preferences?.answers_json ?? {};
  const memberGender = membership.profile?.gender ?? null;
  const applicableDefinitions = mergedDefinitions
    ? filterDefinitionBundleForMember(mergedDefinitions, { gender: memberGender })
    : undefined;

  const showTechnicalPlanIds = MEMBERSHIP_CATALOG_EDITOR_ROLES.includes(ctxRole as never);

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Joined", value: formatMembershipTimestampUtcLabel(membership.joined_at) },
          { label: "Onboarded by", value: membership.audit.onboardedByLabel },
          { label: "Last updated by", value: membership.audit.lastUpdatedByLabel },
          { label: "Last updated", value: formatMembershipTimestampUtcLabel(membership.audit.updatedAt) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{item.label}</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{item.value}</dd>
          </div>
        ))}
      </dl>

      {isLoading && !mergedDefinitions ? (
        <p className="text-sm text-zinc-500">Loading questionnaire snapshot…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewCard title="Identity">
            <ReviewRow label="Name" value={membership.profile?.full_name ?? "—"} />
            <ReviewRow label="Mobile" value={membership.profile?.phone ?? "—"} />
            <ReviewRow label="Email" value={membership.profile?.email ?? "—"} />
            <ReviewRow label="DOB" value={formatDateOfBirth(membership.profile?.date_of_birth)} />
            <ReviewRow label="Gender" value={genderLabel(membership.profile?.gender)} />
          </ReviewCard>
          <ReviewCard title="Membership">
            <ReviewRow label="Branch" value={outletLabel || "—"} />
            <ReviewRow label="Status" value={readableStatus(membership.status)} />
            <ReviewRow label="Plan" value={planPriceLabel} />
            <ReviewRow
              label="Term"
              value={`${membership.start_date ?? "—"} → ${membership.end_date ?? "Open"}`}
            />
          </ReviewCard>
          <ReviewCard title={SECTION_COPY.basic_info.title}>
            <ReviewRow label="Height" value={formatHeightCm(membership.profile?.height_cm)} />
            <ReviewRow label="Weight" value={formatWeightKg(membership.profile?.weight_kg)} />
            <ReviewRow
              label="BMI"
              value={bmi != null ? `${formatBmi(bmi)}${bmiBand ? ` (${BMI_BAND_LABEL[bmiBand]})` : ""}` : "—"}
            />
            {(applicableDefinitions?.basic_info ?? []).map((def) => (
              <ReviewRow
                key={def.id}
                label={def.label}
                value={formatAnswerPreview(def, (basicAnswers as Record<string, unknown>)[def.question_key])}
              />
            ))}
          </ReviewCard>
          <ReviewCard title={SECTION_COPY.health_screening.title}>
            {(applicableDefinitions?.health_screening ?? []).length ? (
              applicableDefinitions!.health_screening.map((def) => (
                <ReviewRow
                  key={def.id}
                  label={def.label}
                  value={formatAnswerPreview(def, (healthAnswers as Record<string, unknown>)[def.question_key])}
                />
              ))
            ) : (
              <ReviewRow label="Questions" value="None configured" />
            )}
          </ReviewCard>
          <ReviewCard title={SECTION_COPY.diet_preferences.title} className="sm:col-span-2">
            <div className="grid gap-x-6 sm:grid-cols-2">
              {(applicableDefinitions?.diet_preferences ?? []).length ? (
                applicableDefinitions!.diet_preferences.map((def) => (
                  <ReviewRow
                    key={def.id}
                    label={def.label}
                    value={formatAnswerPreview(def, (dietAnswers as Record<string, unknown>)[def.question_key])}
                  />
                ))
              ) : (
                <ReviewRow label="Questions" value="None configured" />
              )}
            </div>
          </ReviewCard>
        </div>
      )}

      {canViewProgramPlans ? (
        <CustomerProgramPlansPanel
          membershipId={membership.id}
          profileId={membership.profile_id}
          outletId={membership.outlet_id}
          memberName={membership.profile?.full_name ?? "Member"}
          snapshot={programPlans}
          canAssign={canAssignProgramPlans}
          variant="compact"
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEP_LABELS.slice(0, -1).map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => onJumpToStep(idx)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Edit {label}
          </button>
        ))}
      </div>

      {showTechnicalPlanIds && membership.plan ? (
        <p className="font-mono text-xs text-zinc-500">Internal plan ID: {membership.plan.id}</p>
      ) : null}

      {(canAssignPlan || canAssignTrainer || canSuspend) && (
        <div className="space-y-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Branch controls</h3>
          {canAssignPlan ? (
            <MembershipAssignPlanPanel
              membershipId={membership.id}
              outletDisplay={outletLabel || membership.outlet_id}
              status={membership.status}
              profileLabel={membership.profile?.full_name ?? "Member"}
              plans={catalogue}
              defaultStartDate={defaultStartDate}
            />
          ) : null}

          {canAssignTrainer ? (
            <TrainerAssignInline membership={membership} trainers={trainers} />
          ) : null}

          {canSuspend ? (
            <form action={suspendAction} className="space-y-2">
              <input type="hidden" name="membership_id" value={membership.id} />
              <button
                type="submit"
                disabled={suspendPending || membership.status === "suspended"}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
              >
                {suspendPending ? "Working…" : "Suspend this membership"}
              </button>
              {suspendState.error ? <p className="text-sm text-rose-600">{suspendState.error}</p> : null}
              {suspendState.success ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{suspendState.success}</p>
              ) : null}
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TrainerAssignInline(props: { membership: CustomerMembershipDetailMembership; trainers: TrainerLite[] }) {
  const { membership, trainers } = props;
  const router = useRouter();
  const [state, action, pending] = useActionState(assignTrainerToMembershipAction, {} as SimpleActionState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="membership_id" value={membership.id} />
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
        Coach
        <select
          name="trainer_profile_id"
          defaultValue={membership.assigned_trainer_id ?? ""}
          className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Not assigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name ?? t.email ?? t.id}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Saving…" : "Save coach"}
      </Button>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{state.success}</p> : null}
    </form>
  );
}