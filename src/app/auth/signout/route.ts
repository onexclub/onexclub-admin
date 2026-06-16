import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";
import { ROUTES } from "@/utils/routes";

/**
 * POST /auth/signout — clears Supabase cookies on the redirect response.
 *
 * **Reuse:** mirrors cookie wiring in `auth/callback/route.ts`. HTML forms should prefer
 * {@link signOutAction} in `./actions.ts` (Server Action) for reliable cookie clearing in App Router.
 */
export async function POST(request: NextRequest) {
  let url: string;
  let anonKey: string;
  try {
    ({ url, anonKey } = getPublicSupabaseEnv());
  } catch {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  const redirectTarget = new URL(ROUTES.login, request.url);
  const response = NextResponse.redirect(redirectTarget);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.signOut();
  return response;
}
