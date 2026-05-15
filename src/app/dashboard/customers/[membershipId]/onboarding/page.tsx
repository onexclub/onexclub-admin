import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnboardingQuestionnairePanel } from "@/features/onboarding/components/OnboardingQuestionnairePanel";
import type { OnboardingViewerContext } from "@/features/onboarding/types";
import type { DashboardFeature } from "@/lib/auth/roles";
import { ROLES } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { effectiveManagedOutletIds, getAuthDashboardContext } from "@/services/auth.service";
import { ROUTES } from "@/utils/routes";

const FEATURE: DashboardFeature = "customers";

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function DashboardCustomerOnboardingPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const ctx = await getAuthDashboardContext();
  const supabase = await createServerSupabaseClient();
  const outletIds = effectiveManagedOutletIds(ctx);

  if (!ctx.user) {
    return <EmptyState title="Sign in required" description="Authenticate to capture onboarding responses." />;
  }

  if (!outletIds.length) {
    return (
      <EmptyState
        title="No branch assigned"
        description="You need at least one managed outlet before questionnaires load."
      />
    );
  }

  let membershipQuery = supabase
    .from("gym_memberships")
    .select(
      "id,outlet_id,profile_id,profile:profiles!profile_id(full_name,email)",
    )
    .eq("id", membershipId)
    .is("deleted_at", null);

  if (ctx.appRole === ROLES.TRAINER) {
    membershipQuery = membershipQuery.eq("assigned_trainer_id", ctx.user.id);
  }

  const { data: membership, error } = await membershipQuery.maybeSingle();

  if (error) {
    return <EmptyState title="Unable to open onboarding" description={error.message} />;
  }
  if (!membership?.outlet_id || !outletIds.includes(membership.outlet_id)) {
    notFound();
  }

  const profileNested = firstOrSelf(membership.profile as unknown as never | never[] | null);
  const displayName =
    (profileNested as { full_name?: string | null; email?: string | null } | null)?.full_name ||
    (profileNested as { full_name?: string | null; email?: string | null } | null)?.email ||
    "Member";

  const viewer: OnboardingViewerContext = {
    role: ctx.appRole,
    profileId: membership.profile_id,
    outletId: membership.outlet_id,
    membershipId: membership.id,
    actorProfileId: ctx.user.id,
    isCustomerActor: ctx.appRole === ROLES.CUSTOMER,
  };

  return (
    <RoleGuard role={ctx.appRole} feature={FEATURE}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <nav className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={ROUTES.dashboardCustomers} className="hover:text-orange-600 dark:hover:text-orange-400">
            Customers
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <Link
            href={`${ROUTES.dashboardCustomers}/${membershipId}`}
            className="hover:text-orange-600 dark:hover:text-orange-400"
          >
            {displayName}
          </Link>
          <span aria-hidden className="px-2 text-zinc-400">
            /
          </span>
          <span className="text-zinc-900 dark:text-zinc-50">Onboarding</span>
        </nav>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Onboarding questionnaire</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sections collapse for tablet/front-desk ergonomics — save drafts as you intake the member between phones and kiosks.
          </p>
        </div>

        <OnboardingQuestionnairePanel viewer={viewer} outletId={membership.outlet_id} />
      </div>
    </RoleGuard>
  );
}
