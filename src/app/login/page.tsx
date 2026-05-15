import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ROUTES } from "@/utils/routes";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="mb-8 flex flex-col items-center gap-3">
        <BrandLogo variant="emblem" priority />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">One X Club · Admin</p>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-500">Gym operations console — use your work email.</p>
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-sm">
          <Link href={ROUTES.forgotPassword} className="font-medium text-orange-700 hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Trouble signing in? Confirm your Supabase user exists and your profile role matches your assignment.
        </p>
        <p className="mt-4 text-center text-sm">
          <Link href="/" className="font-medium text-orange-700 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
