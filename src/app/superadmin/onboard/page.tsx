import { OnboardGymForm } from "@/components/superadmin/OnboardGymForm";

export default function SuperadminOnboardPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Onboard a new gym</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Creates an organization, the first gym branch (<code className="text-xs">outlets</code> row) with required
          address details, and a gym admin login. Successful onboarding sends you back to{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">All gyms</span> with a success toast (
          <code className="text-xs">?toast=gym-created</code>) and refreshed list (page&nbsp;1). The admin user is
          provisioned with the Supabase Admin API on the server — the service role key never touches the browser.
        </p>
      </div>
      <OnboardGymForm />
    </div>
  );
}
