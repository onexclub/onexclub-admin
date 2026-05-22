import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { getAuthDashboardContext } from "@/services/auth.service";
import { homePathForRole, ROUTES } from "@/utils/routes";

/** Moody gym photography — swap URL here if you replace the hero asset (requires `images.remotePatterns` in `next.config.ts`). */
const GYM_HERO_IMAGE =
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2400&q=80";

export default async function HomePage() {
  const ctx = await getAuthDashboardContext();
  if (ctx.user) {
    redirect(homePathForRole(ctx.appRole));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      <Image
        src={GYM_HERO_IMAGE}
        alt="Modern gym floor with training equipment"
        fill
        priority
        className="object-cover opacity-[0.38]"
        sizes="100vw"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black via-black/88 to-orange-950/35"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-12 px-6 py-16 lg:flex-row lg:items-center lg:gap-20 lg:py-24">
        <div className="max-w-xl flex-1 space-y-8">
          <BrandLogo variant="wordmark" priority className="!h-[4.5rem] !w-[min(100%,18rem)] sm:!h-[5.25rem] sm:!w-[22rem]" />
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Everything your gym needs,{" "}
              <span className="text-gradient-brand">in one place</span>
            </h1>
            <p className="text-sm leading-relaxed text-zinc-300">
              Manage members, staff, and daily operations from a single secure console. Sign in with the
              account your gym or platform team set up for you.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={ROUTES.login}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-8 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:from-amber-400 hover:to-orange-500"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-sm flex-1 justify-center lg:mx-0 lg:max-w-md">
          <div className="relative aspect-square w-full max-w-[280px] drop-shadow-[0_0_48px_rgba(234,88,12,0.35)] sm:max-w-[320px]">
            <Image
              src="/brand/logo-emblem.png"
              alt="ONE X CLUB emblem"
              fill
              className="object-contain"
              sizes="320px"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
