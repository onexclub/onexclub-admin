import type { OutletOpeningHoursJson } from "@/lib/outlets/schedule";

/**
 * Client-safe types + formatters for gym org / outlet UI.
 * **Reuse:** Import from Client Components; server loaders stay in `gym-organization-dashboard.ts`.
 */

export type GymAddressJson = {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
};

export type GymDashboardOrganization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address_json: GymAddressJson | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type ManagedOutletSummary = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  state: string | null;
  country: string | null;
};

export type ManagedOutletDetail = ManagedOutletSummary & {
  phone: string | null;
  email: string | null;
  is_active: boolean;
  opening_hours: OutletOpeningHoursJson;
};

export function formatGymOrganizationAddressLines(address: GymAddressJson | null | undefined): string[] {
  if (!address || typeof address !== "object") return [];
  const cityState = [address.city, address.state].filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const line2 = cityState.join(", ");
  const lines = [address.street, line2 || null, address.zip, address.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
  return lines;
}

export function formatOutletLocationLine(o: ManagedOutletSummary): string {
  const parts = [o.address, o.city, o.state, o.country].filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return parts.length ? parts.join(", ") : "—";
}
