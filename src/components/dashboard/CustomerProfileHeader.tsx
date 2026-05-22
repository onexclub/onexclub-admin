import { Badge } from "@/components/ui/badge";
import { formatInrPrice, profileInitials } from "@/lib/customers/format-inr";
import { rosterStatusDisplay } from "@/lib/customers/roster-status";
import { formatMembershipTimestampUtcLabel } from "@/lib/date-term";

type Props = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  outletLabel: string;
  status: string;
  endDate: string | null;
  joinedAt: string | null;
};

/** Profile header for `/dashboard/customers/[membershipId]` — audit trail lives in workspace tabs. */
export function CustomerProfileHeader(props: Props) {
  const { fullName, phone, email, outletLabel, status, endDate, joinedAt } = props;
  const display = rosterStatusDisplay(status, endDate);

  return (
    <header className="space-y-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-lg font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
            aria-hidden
          >
            {profileInitials(fullName)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {fullName ?? "Unnamed member"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {phone ? <span>{phone}</span> : null}
              {phone && email ? <span aria-hidden>·</span> : null}
              {email ? <span>{email}</span> : null}
              {(phone || email) && outletLabel ? <span aria-hidden>·</span> : null}
              {outletLabel ? <span>{outletLabel}</span> : null}
            </p>
            {joinedAt ? (
              <p className="mt-1 text-xs text-zinc-500">
                Joined {formatMembershipTimestampUtcLabel(joinedAt)}
              </p>
            ) : null}
          </div>
        </div>
        <Badge variant={display.variant} className="text-xs">
          {display.label}
        </Badge>
      </div>
    </header>
  );
}

export { formatInrPrice };
