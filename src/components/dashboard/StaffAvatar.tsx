import { cn } from "@/lib/utils/cn";

function initialsFromName(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

type Props = {
  avatarUrl: string | null | undefined;
  fullName: string | null | undefined;
  email: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
} as const;

/**
 * Roster / profile headshot with initials fallback.
 *
 * **Reuse:** import anywhere staff or member rows need a consistent avatar chip.
 */
export function StaffAvatar({ avatarUrl, fullName, email, size = "md", className }: Props) {
  const label = fullName ?? email ?? "Team member";
  const dim = sizeClasses[size];

  if (avatarUrl?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Supabase public storage URLs
      <img
        src={avatarUrl}
        alt=""
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700", dim, className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-900 ring-1 ring-orange-200/80 dark:bg-orange-950/50 dark:text-orange-100 dark:ring-orange-900/40",
        dim,
        className,
      )}
      title={label}
    >
      {initialsFromName(fullName, email)}
    </span>
  );
}
