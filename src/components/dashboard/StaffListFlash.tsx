"use client";

/**
 * Reads `?toast=…` on `/dashboard/staff`, shows a one-time banner, then strips the param.
 *
 * **Reuse:** same pattern as `SuperadminFlashBanner` — add keys here when new staff flows redirect with `toast`.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LABELS: Record<string, string> = {
  "staff-created": "Team member created. They can sign in with the temporary password you shared.",
};

export function StaffListFlash() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key) return;

    const text = LABELS[key];
    if (text) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ephemeral flash keyed off `toast` querystring
      setMessage(text);
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  if (!message) return null;

  return (
    <div
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
      role="status"
    >
      {message}
    </div>
  );
}
