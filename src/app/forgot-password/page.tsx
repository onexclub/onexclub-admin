import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ROUTES } from "@/utils/routes";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-orange-600">OnexClub Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Reset password</h1>
          <p className="mt-2 text-sm text-zinc-500">
            We will email you a link to choose a new password. Uses the same Supabase Auth user as
            sign-in.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm">
          <Link href={ROUTES.login} className="font-medium text-orange-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
