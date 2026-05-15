import Link from "next/link";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROUTES } from "@/utils/routes";

export default async function UpdatePasswordPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Link invalid or expired</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Open the reset link from your email again, or request a new one from forgot password.
          </p>
          <p className="mt-6 text-sm">
            <Link href={ROUTES.forgotPassword} className="font-medium text-orange-700 hover:underline">
              Request reset link
            </Link>
            {" · "}
            <Link href={ROUTES.login} className="font-medium text-orange-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-orange-600">OnexClub Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Choose a new password</h1>
        </div>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
