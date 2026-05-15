"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MembershipPlanUpsertForm } from "@/components/admin/MembershipPlanUpsertForm";
import type { MembershipPlanAdminRow } from "@/lib/admin/membership-plans-admin";
import { buildPlanBenefitLines } from "@/lib/admin/plan-benefits";
import { setMembershipPlanActiveAction } from "@/app/admin/plans/actions";

type OutletLite = { id: string; name: string; city: string | null };

function accentFromHex(hex?: string | null): string {
  const fallback = "#f97316";
  if (!hex || typeof hex !== "string") return fallback;
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^#[0-9a-fA-F]{3}$/.test(t))
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toUpperCase();
  return fallback;
}

function formatBillingLabel(plan: MembershipPlanAdminRow): string {
  const m: Record<string, string> = {
    monthly: "per month",
    quarterly: "per quarter",
    half_yearly: "per half year",
    yearly: "per year",
  };
  return m[plan.billing_cycle] ?? `per ${plan.billing_cycle.replaceAll("_", " ")}`;
}

/**
 * Card gallery + guarded editor pane for gym catalogue SKUs.
 *
 * Mirrors `membership_plan` affordances surfaced to customers; benefits copy is centralized in `@/lib/admin/plan-benefits.ts`.
 */
export function AdminMembershipPlansClient(props: {
  outlets: OutletLite[];
  plans: MembershipPlanAdminRow[];
  /** When true, catalogue builder + archive toggles disappear (branch admins / read-only auditors). */
  readOnly?: boolean;
}) {
  const { outlets, plans } = props;
  const readOnly = props.readOnly ?? false;
  const router = useRouter();
  const [showEditor, setShowEditor] = useState(plans.length === 0 && !readOnly);
  const [draft, setDraft] = useState<MembershipPlanAdminRow | null>(null);
  const editorAnchor = useRef<HTMLDivElement | null>(null);

  const outletLookup = useMemo(
    () => Object.fromEntries(outlets.map((o) => [o.id, o] as const)) as Record<string, OutletLite>,
    [outlets],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, MembershipPlanAdminRow[]>();
    for (const o of outlets) map.set(o.id, []);
    for (const p of plans) {
      const bucket = map.get(p.outlet_id);
      if (bucket) bucket.push(p);
      else map.set(p.outlet_id, [p]);
    }
    for (const [, arr] of map) arr.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));
    return map;
  }, [plans, outlets]);

  /** Force remount of the form when hopping between drafts to avoid mismatched DOM defaults after React 19 merges. */
  const editorKey = draft ? `edit-${draft.id}` : "create";

  useEffect(() => {
    if (!showEditor) return;
    editorAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showEditor, draft]);

  function openCreate() {
    setDraft(null);
    setShowEditor(true);
  }

  function openEdit(plan: MembershipPlanAdminRow) {
    setDraft(plan);
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setDraft(null);
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-orange-500/25 bg-orange-500/10 p-5 dark:border-orange-500/35 dark:bg-orange-950/40">
        <div className="max-w-xl space-y-1">
          <h3 className="text-base font-semibold text-orange-950 dark:text-orange-50">Shape how members perceive value</h3>
          <p className="text-sm text-orange-900/85 dark:text-orange-100/80">
            Showcase benefits up front — every card mirrors what marketing copy + onboarding inherit from the same SKU. Edit anytime; linked members observe the
            behavioral rules immediately via plan_id relationships.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-600/35 transition hover:bg-orange-700"
              >
                + Create new plan
              </button>
              {plans.length > 0 && showEditor ? (
                <button
                  type="button"
                  onClick={closeEditor}
                  className="inline-flex items-center justify-center rounded-xl border border-orange-900/25 bg-white/80 px-4 py-2.5 text-sm font-medium text-orange-950 hover:bg-white dark:border-orange-400/35 dark:bg-zinc-900 dark:text-orange-50 dark:hover:bg-zinc-800"
                >
                  Hide editor
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-orange-900/80 dark:text-orange-100/80">
              View-only access — ask a gym owner to publish catalogue changes.
            </p>
          )}
        </div>
      </div>

      <div ref={editorAnchor} id="plan-editor">
        {showEditor && !readOnly ? (
          <MembershipPlanUpsertForm
            outlets={outlets}
            outletLookup={outletLookup}
            draft={draft}
            editorKey={editorKey}
            onCancel={() => {
              router.refresh();
              closeEditor();
            }}
          />
        ) : null}
      </div>

      {plans.length === 0 && !showEditor && !readOnly ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
          <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">Nothing published yet — start above</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Plans double as onboarding SKUs once members move through admin flows. Anchor each tier to a branch, then revisit this page anytime you want to remix
            benefits.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 inline-flex rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Open plan builder
          </button>
        </div>
      ) : null}

      <div className="space-y-12">
        {outlets.map((outlet) => {
          const list = grouped.get(outlet.id) ?? [];
          if (!list.length) return null;
          return (
            <section key={outlet.id} className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{outlet.name}</h4>
                <span className="rounded-full bg-zinc-100 px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {list.length} plan{list.length === 1 ? "" : "s"}
                  {outlet.city ? ` · ${outlet.city}` : ""}
                </span>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {list.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    outlet={outlet}
                    readOnly={readOnly}
                    onEdit={openEdit}
                    onArchiveToggle={() => router.refresh()}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PlanCard(props: {
  plan: MembershipPlanAdminRow;
  outlet: OutletLite;
  readOnly?: boolean;
  onEdit: (plan: MembershipPlanAdminRow) => void;
  onArchiveToggle: () => void;
}) {
  const { plan, outlet, readOnly = false, onEdit, onArchiveToggle } = props;
  const accent = accentFromHex(plan.color_hex);

  const lines = buildPlanBenefitLines(plan);

  const priceStr = `${(plan.currency || "INR").toUpperCase()} ${plan.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const active = plan.is_active;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-[0_20px_50px_-16px_rgb(24_24_27_/_0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_56px_-12px_rgb(24_24_27_/_0.45)] dark:border-zinc-800 dark:bg-zinc-950 ${
        !active ? "opacity-90" : ""
      }`}
    >
      <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, rgb(251 146 60))` }} aria-hidden />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h5 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{plan.name}</h5>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-50" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}
              >
                {active ? "Available" : "Archived"}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
              {outlet.name}
              {outlet.city ? ` · ${outlet.city}` : ""}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {plan.description ?? "Tell the story behind this SKU — richer descriptions reinforce upgrades at the front desk."}
        </p>

        <div className="mt-5 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/85">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">Investment</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight" style={{ color: accent }}>
              {priceStr}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{formatBillingLabel(plan)}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-1 flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">What members get</p>
          <ul className="mt-3 flex flex-1 flex-col gap-2.5">
            {lines.map(({ kind, text }, i) => (
              <li key={`${kind}-${i}`} className="flex gap-2.5 text-sm leading-snug">
                <span
                  className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${kind === "feature" ? "border-purple-400/70 bg-purple-500/15 text-purple-700 dark:border-purple-500/40 dark:text-purple-50" : "border-emerald-400/70 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/35 dark:text-emerald-50"}`}
                  aria-hidden
                >
                  {kind === "feature" ? "★" : "✓"}
                </span>
                <span className="text-zinc-700 dark:text-zinc-200">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          {!readOnly ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(plan)}
                className="inline-flex flex-1 min-w-[120px] items-center justify-center rounded-xl border border-orange-600/55 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100 dark:hover:bg-orange-500/25"
              >
                Edit plan
              </button>
              <form
                action={async (formData) => {
                  await setMembershipPlanActiveAction(formData);
                  onArchiveToggle();
                }}
              >
                <input type="hidden" name="plan_id" value={plan.id} />
                <input type="hidden" name="is_active" value={plan.is_active ? "false" : "true"} />
                <button
                  type="submit"
                  className="inline-flex h-full min-h-[42px] items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {plan.is_active ? "Archive SKU" : "Restore SKU"}
                </button>
              </form>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Read-only — catalogue edits require a gym owner.</p>
          )}
        </div>
      </div>
    </article>
  );
}
