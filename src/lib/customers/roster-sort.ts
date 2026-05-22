/** URL `sort` values — parsed on the server in `/dashboard/customers`. */
export const CUSTOMER_ROSTER_SORT_OPTIONS = [
  { value: "joined_desc", label: "Date added (newest)" },
  { value: "joined_asc", label: "Date added (oldest)" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
] as const;

export type CustomerRosterSort = (typeof CUSTOMER_ROSTER_SORT_OPTIONS)[number]["value"];

type RowWithSortKeys = {
  joined_at: string | null;
  profile: { full_name: string | null } | null;
};

const SORT_SET = new Set<string>(["joined_desc", "joined_asc", "name_asc", "name_desc"]);

export function parseCustomerRosterSort(raw: string | undefined): CustomerRosterSort {
  if (raw && SORT_SET.has(raw)) return raw as CustomerRosterSort;
  return "joined_desc";
}

/** Name sorts run in memory; `joined_*` should use the Supabase `order` clause when possible. */
export function sortCustomerRosterRows<T extends RowWithSortKeys>(rows: T[], sort: CustomerRosterSort): T[] {
  const copy = [...rows];
  if (sort === "name_asc" || sort === "name_desc") {
    copy.sort((a, b) => {
      const an = (a.profile?.full_name ?? "").trim().toLowerCase();
      const bn = (b.profile?.full_name ?? "").trim().toLowerCase();
      if (!an && !bn) return 0;
      if (!an) return 1;
      if (!bn) return -1;
      const cmp = an.localeCompare(bn);
      return sort === "name_asc" ? cmp : -cmp;
    });
    return copy;
  }
  if (sort === "joined_asc") {
    copy.sort((a, b) => {
      const at = a.joined_at ? Date.parse(a.joined_at) : 0;
      const bt = b.joined_at ? Date.parse(b.joined_at) : 0;
      return at - bt;
    });
  }
  return copy;
}

export function joinedAtOrderAscending(sort: CustomerRosterSort): boolean {
  return sort === "joined_asc";
}
