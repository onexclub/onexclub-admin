/** URL `limit` / `page` for `/dashboard/customers` roster pagination. */

export const CUSTOMER_ROSTER_PAGE_SIZE_OPTIONS = [50, 100, 500] as const;

export type CustomerRosterPageSize = (typeof CUSTOMER_ROSTER_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_CUSTOMER_ROSTER_PAGE_SIZE: CustomerRosterPageSize = 50;

const PAGE_SIZE_SET = new Set<number>(CUSTOMER_ROSTER_PAGE_SIZE_OPTIONS);

export function parseCustomerRosterPageSize(raw: string | undefined): CustomerRosterPageSize {
  const n = Number(raw);
  if (PAGE_SIZE_SET.has(n)) return n as CustomerRosterPageSize;
  return DEFAULT_CUSTOMER_ROSTER_PAGE_SIZE;
}

export function parseCustomerRosterPage(raw: string | undefined): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1) return n;
  return 1;
}

export type PaginatedSlice<T> = {
  rows: T[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: CustomerRosterPageSize;
  /** 1-based inclusive range labels for footer, e.g. "1–50 of 234". */
  rangeFrom: number;
  rangeTo: number;
};

/** Slice an in-memory roster after search/sort — server applies DB filters first. */
export function paginateCustomerRosterRows<T>(
  rows: T[],
  page: number,
  pageSize: CustomerRosterPageSize,
): PaginatedSlice<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return {
    rows: slice,
    total,
    totalPages,
    page: safePage,
    pageSize,
    rangeFrom: total === 0 ? 0 : start + 1,
    rangeTo: total === 0 ? 0 : Math.min(start + pageSize, total),
  };
}

/** Page numbers to render — compact window with first/last when needed. */
export function customerRosterPageNumbers(current: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}
