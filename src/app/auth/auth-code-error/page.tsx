import Link from "next/link";
import { ROUTES } from "@/utils/routes";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          The sign-in or reset link could not be completed. It may have expired, or the redirect URL
          may not be allowlisted in Supabase.
        </p>
        <p className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
          <Link href={ROUTES.forgotPassword} className="font-medium text-orange-700 hover:underline">
            Try reset again
          </Link>
          <span className="text-zinc-400">·</span>
          <Link href={ROUTES.login} className="font-medium text-orange-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
