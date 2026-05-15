import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnboardingQuestionnairePanel } from "@/features/onboarding/components/OnboardingQuestionnairePanel";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import { ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageOutletForBranchAdmin, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AdminCustomerOnboardingPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();

  if (!ctx.user) {
    return <EmptyState title="Sign in required" description="Authenticate to capture onboarding questionnaires." />;
  }

  const { data: membership, error } = await supabase
    .from("gym_memberships")
    .select("id,outlet_id,profile_id,assigned_trainer_id,profile:profiles!profile_id(full_name,email)")
    .eq("id", membershipId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return <EmptyState title="Unable to open onboarding" description={error.message} />;
  }

  if (!membership?.outlet_id || !canManageOutletForBranchAdmin(ctx, membership.outlet_id)) {
    notFound();
  }

  if (ctx.appRole === ROLES.TRAINER && membership.assigned_trainer_id !== ctx.user.id) {
    notFound();
  }

  const profileNested = firstOrSelf(membership.profile as unknown as never[] | never | null);
  const profileObj = profileNested as { full_name?: string | null; email?: string | null } | null;
  const displayName = profileObj?.full_name || profileObj?.email || "Member";

  const viewer: OnboardingViewerContext = {
    role: ctx.appRole,
    profileId: membership.profile_id,
    outletId: membership.outlet_id,
    membershipId: membership.id,
    actorProfileId: ctx.user.id,
    isCustomerActor: false,
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-16">
      <nav className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href={ROUTES.adminCustomers} className="hover:text-orange-600 dark:hover:text-orange-400">
          Customers
        </Link>
        <span aria-hidden className="px-2 text-zinc-400">
          /
        </span>
        <span className="text-zinc-900 dark:text-zinc-50">{displayName}</span>
        <span aria-hidden className="px-2 text-zinc-400">
          /
        </span>
        <span className="text-zinc-900 dark:text-zinc-50">Onboarding</span>
      </nav>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Intake questionnaires</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Three collapsible chapters (basic, screening, diet) hydrate from merged global + outlet `question_definitions` rows.
        </p>
      </div>

      <OnboardingQuestionnairePanel viewer={viewer} outletId={membership.outlet_id} />
    </div>
  );
}
