/**
 * Next.js middleware entry (must live at `src/middleware.ts` or project-root `middleware.ts`).
 *
 * NOTE (Next.js 16 + Turbopack): `config.matcher` must be statically analyzable, so it is inlined here.
 * If you need to tune matchers, edit the array below and keep the comment in sync.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
