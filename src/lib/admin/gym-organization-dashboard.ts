import {
  exceptionRowsToClosures,
  mergeOutletHoursSources,
  outletHourRowsToWeekly,
  type OutletHourExceptionRowDb,
  type OutletHourRowDb,
} from "@/lib/outlets/outlet-hours-db";
import {
  type GymAddressJson,
  type GymDashboardOrganization,
  type ManagedOutletDetail,
  type ManagedOutletSummary,
} from "@/lib/admin/gym-organization-shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuthDashboardContext } from "@/services/auth.service";
import { effectiveManagedOutletIds } from "@/services/auth.service";
import { isGymAdminShellRole } from "@/types/roles";

/**
 * Gym organization snapshot for `/admin` UI (brand + contact + address).
 *
 * **Reuse:** Prefer this loader from any gym-admin Server Component instead of repeating
 * `outlets → organization_id → organizations` joins. Reads use the logged-in user's
 * Supabase JWT (RLS on) — never the service-role client in `createServiceRoleSupabaseClient`.
 *
 * Outlet scope comes from `ctx.managedOutletIds` (`getAuthDashboardContext`): every role with a
 * `staff_assignments` row gets those outlets; gym owners also get every branch in the org.
 *
 * See `src/lib/supabase/admin.ts` for when service role is appropriate (elevated writes after authz).
 */

export type {
  GymAddressJson,
  GymDashboardOrganization,
  ManagedOutletDetail,
  ManagedOutletSummary,
} from "@/lib/admin/gym-organization-shared";
export {
  formatGymOrganizationAddressLines,
  formatOutletLocationLine,
} from "@/lib/admin/gym-organization-shared";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function normalizeOrgRow(
  row: Record<string, unknown> & { id: string; name: string; slug: string },
): GymDashboardOrganization {
  const logo = (row.logo_url as string | null | undefined) ?? null;
  const email = (row.contact_email as string | null | undefined) ?? null;
  const phone = (row.contact_phone as string | null | undefined) ?? null;
  const addressJson = row.address_json;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo_url: logo,
    contact_email: email,
    contact_phone: phone,
    address_json:
      addressJson && typeof addressJson === "object" && !Array.isArray(addressJson)
        ? (addressJson as GymAddressJson)
        : null,
  };
}

/**
 * Loads the organization backing the gym dashboard (brand + HQ address).
 *
 * **Why staff-anchored outlet ids first:** `managedOutletIds` can include org-wide outlets for `gym_owner`.
 * The first resolution step uses outlets from `ctx.staffAssignments` so we always join through a row that
 * satisfies `staff_outlets_read` / `my_staff_outlet_ids()`. Then we embed `organizations` from that outlet.
 *
 * If you see branches on this page but "HQ profile" is missing, the embed or `organizations` SELECT was
 * blocked — check RLS on `organizations` and API errors (we log warnings in development).
 */
export async function loadGymOrganizationForAdminDashboard(
  supabase: ServerSupabase,
  ctx: AuthDashboardContext,
): Promise<GymDashboardOrganization | null> {
  if (!isGymAdminShellRole(ctx.appRole)) return null;

  const outletIds = effectiveManagedOutletIds(ctx);
  if (!outletIds.length) return null;

  const staffAnchored = [...new Set(ctx.staffAssignments.map((s) => s.outlet_id).filter((id) => outletIds.includes(id)))];
  const resolutionIds = staffAnchored.length > 0 ? staffAnchored : outletIds;

  const { data: withOrg, error: embedErr } = await supabase
    .from("outlets")
    .select(
      `
      organizations (
        id,
        name,
        slug,
        logo_url,
        address_json,
        contact_email,
        contact_phone
      )
    `,
    )
    .in("id", resolutionIds)
    .is("deleted_at", null)
    .limit(1);

  if (embedErr && process.env.NODE_ENV === "development") {
    console.warn("[loadGymOrganizationForAdminDashboard] embed:", embedErr.message);
  }

  const row0 = withOrg?.[0] as { organizations?: unknown } | undefined;
  const orgRaw = row0?.organizations;
  const orgCandidate = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
  if (orgCandidate && typeof orgCandidate === "object" && orgCandidate !== null && "id" in orgCandidate && "name" in orgCandidate) {
    return normalizeOrgRow(orgCandidate as Record<string, unknown> & { id: string; name: string; slug: string });
  }

  const { data: outlets, error: outletsErr } = await supabase
    .from("outlets")
    .select("organization_id")
    .in("id", resolutionIds)
    .is("deleted_at", null);

  if (outletsErr && process.env.NODE_ENV === "development") {
    console.warn("[loadGymOrganizationForAdminDashboard] outlets:", outletsErr.message);
  }

  const rawOrgIds = (outlets ?? []).map((o) => o.organization_id).filter((id): id is string => Boolean(id));
  const orgIdsOrdered = [...new Set(rawOrgIds)];
  if (!orgIdsOrdered.length) return null;

  const { data: orgRows, error: orgErr } = await supabase
    .from("organizations")
    .select("id,name,slug,logo_url,address_json,contact_email,contact_phone")
    .in("id", orgIdsOrdered)
    .is("deleted_at", null)
    .limit(1);

  if (orgErr && process.env.NODE_ENV === "development") {
    console.warn("[loadGymOrganizationForAdminDashboard] organizations:", orgErr.message);
  }

  const row = orgRows?.[0] as Record<string, unknown> & { id: string; name: string; slug: string } | undefined;
  if (!row) return null;
  return normalizeOrgRow(row);
}

/**
 * Lists outlets the current user may see (RLS). Includes every outlet in `effectiveManagedOutletIds`
 * (direct `staff_assignments` + org expansion for `gym_owner`).
 */
export async function loadManagedOutletsForAdmin(
  supabase: ServerSupabase,
  ctx: AuthDashboardContext,
): Promise<ManagedOutletSummary[]> {
  if (!isGymAdminShellRole(ctx.appRole)) return [];

  const outletIds = effectiveManagedOutletIds(ctx);
  if (!outletIds.length) return [];

  const { data, error } = await supabase
    .from("outlets")
    .select("id,name,city,address,state,country")
    .in("id", outletIds)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) return [];
  return (data ?? []) as ManagedOutletSummary[];
}

/**
 * Loads editable branch fields for gym settings. **Operating hours** load from `outlet_hours` +
 * `outlet_hour_exceptions` (migration `019_*`). Legacy `outlets.opening_hours` JSON was removed —
 * use SQL or a one-off script to migrate old JSON into those tables if needed.
 */
export async function loadManagedOutletDetailsForAdmin(
  supabase: ServerSupabase,
  ctx: AuthDashboardContext,
): Promise<ManagedOutletDetail[]> {
  if (!isGymAdminShellRole(ctx.appRole)) return [];

  const outletIds = effectiveManagedOutletIds(ctx);
  if (!outletIds.length) return [];

  const { data, error } = await supabase
    .from("outlets")
    .select("id,name,city,address,state,country,phone,email,is_active")
    .in("id", outletIds)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) return [];

  const { data: hRows, error: hErr } = await supabase
    .from("outlet_hours")
    .select("outlet_id,day_of_week,shift_number,is_closed,is_24_hours,open_time,close_time")
    .in("outlet_id", outletIds);

  if (hErr && process.env.NODE_ENV === "development") {
    console.warn("[loadManagedOutletDetailsForAdmin] outlet_hours:", hErr.message);
  }

  const { data: eRows, error: eErr } = await supabase
    .from("outlet_hour_exceptions")
    .select("outlet_id,exception_date,shift_number,is_closed,is_24_hours,open_time,close_time,reason")
    .in("outlet_id", outletIds);

  if (eErr && process.env.NODE_ENV === "development") {
    console.warn("[loadManagedOutletDetailsForAdmin] outlet_hour_exceptions:", eErr.message);
  }

  const hoursByOutlet = new Map<string, OutletHourRowDb[]>();
  for (const r of hRows ?? []) {
    const row = r as Record<string, unknown>;
    const oid = String(row.outlet_id ?? "");
    if (!oid) continue;
    const list = hoursByOutlet.get(oid) ?? [];
    list.push({
      outlet_id: oid,
      day_of_week: Number(row.day_of_week),
      shift_number: Number(row.shift_number),
      is_closed: Boolean(row.is_closed),
      is_24_hours: Boolean(row.is_24_hours),
      open_time: (row.open_time as string | null) ?? null,
      close_time: (row.close_time as string | null) ?? null,
    });
    hoursByOutlet.set(oid, list);
  }

  const excByOutlet = new Map<string, OutletHourExceptionRowDb[]>();
  for (const r of eRows ?? []) {
    const row = r as Record<string, unknown>;
    const oid = String(row.outlet_id ?? "");
    if (!oid) continue;
    const list = excByOutlet.get(oid) ?? [];
    const ed = row.exception_date as string;
    list.push({
      outlet_id: oid,
      exception_date: typeof ed === "string" && ed.length >= 10 ? ed.slice(0, 10) : String(ed),
      shift_number: Number(row.shift_number),
      is_closed: Boolean(row.is_closed),
      is_24_hours: Boolean(row.is_24_hours),
      open_time: (row.open_time as string | null) ?? null,
      close_time: (row.close_time as string | null) ?? null,
      reason: (row.reason as string | null) ?? null,
    });
    excByOutlet.set(oid, list);
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const id = String(r.id);
    const weekly = outletHourRowsToWeekly(hoursByOutlet.get(id) ?? []);
    const closures = exceptionRowsToClosures(excByOutlet.get(id) ?? []);
    return {
      id,
      name: String(r.name ?? ""),
      city: (r.city as string | null) ?? null,
      address: (r.address as string | null) ?? null,
      state: (r.state as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      is_active: Boolean(r.is_active ?? true),
      opening_hours: mergeOutletHoursSources({ weekly, closures }),
    };
  });
}

