import Link from "next/link";
import { ROUTES } from "@/utils/routes";

/** Generic wall for JWT-authenticated routes that failed middleware / guards. Role strings stay centralized elsewhere. */

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-16 text-center">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Access denied</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">You do not have access</h1>
        <p className="mt-3 text-sm text-zinc-600">
          The gym console validates every `/dashboard/**` navigation against shared permission maps in `src/lib/auth/roles.ts`. If this is unexpected, contact an organisation owner or platform superadmin.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={ROUTES.dashboard}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Back to dashboard
          </Link>
          <Link
            href={ROUTES.login}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 px-5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Sign in as another user
          </Link>
        </div>
      </div>
    </div>
  );
}
