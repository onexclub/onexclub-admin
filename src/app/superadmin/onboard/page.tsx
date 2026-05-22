import { OnboardGymForm } from "@/components/superadmin/OnboardGymForm";

export default function SuperadminOnboardPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Onboard a new gym</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Add a new gym brand, its first location with full address details, and an admin who can sign in and run
          day-to-day operations. When you finish, you&apos;ll return to{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">All gyms</span> with the updated list and a
          confirmation that the gym was created.
        </p>
      </div>
      <OnboardGymForm />
    </div>
  );
}
