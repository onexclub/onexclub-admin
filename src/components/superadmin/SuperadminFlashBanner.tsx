"use client";

/**
 * Reads `?toast=…` from the URL once, shows an inline banner (no toast library),
 * then strips the param so flashes are not bookmarked.
 *
 * **Reuse:** same pattern works for `/dashboard/**` flashes if redirects add `toast=`.
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LABELS: Record<string, string> = {
  "gym-created": "Gym onboarded successfully.",
  "branch-created": "Branch created.",
  "branch-updated": "Branch updated.",
  "org-updated": "Organization details saved.",
};

export function SuperadminFlashBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key) return;

    const text = LABELS[key];
    // Showing URL-driven flashes requires promoting search params into state once router.replace clears the flag.
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
      className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-700/35 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-50 shadow-sm"
      role="status"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/50"
      >
        Dismiss
      </button>
    </div>
  );
}
