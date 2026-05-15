"use client";

/**
 * Composes read-only gym profile cards + editable settings forms for gym admins.
 * **Reuse:** Import from `/admin/organization` and `/dashboard/branches` server pages.
 * Brand logo upload: `GymOrganizationBrandLogoForm` (`uploadGymOrganizationBrandLogoAction` + `gym-brand-logos` bucket).
 */

import { GymLogoThumbnail } from "@/components/superadmin/GymLogoThumbnail";
import {
  GymOrganizationBrandLogoForm,
  GymOrganizationProfileForm,
  OutletBranchSettingsForm,
} from "@/components/admin/GymSettingsPanels";
import {
  formatGymOrganizationAddressLines,
  type GymDashboardOrganization,
  type ManagedOutletDetail,
} from "@/lib/admin/gym-organization-shared";

export function GymProfileSettingsSection({
  org,
  outlets,
  canEditOrg,
  canEditBranches,
}: {
  org: GymDashboardOrganization | null;
  outlets: ManagedOutletDetail[];
  canEditOrg: boolean;
  canEditBranches: boolean;
}) {
  const lines = org ? formatGymOrganizationAddressLines(org.address_json) : [];

  return (
    <div className="space-y-8">
      {org ? (
        <>
          <ProfileReadOnlyCard org={org} lines={lines} />
          <GymOrganizationBrandLogoForm org={org} canEdit={canEditOrg} />
          <GymOrganizationProfileForm org={org} canEdit={canEditOrg} />
        </>
      ) : null}

      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Branch settings</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Per-location address, contact, weekly hours (including split shifts and 24h), and dated exceptions in{" "}
          <span className="font-mono">outlet_hours</span> / <span className="font-mono">outlet_hour_exceptions</span>.
        </p>
        <div className="mt-4 space-y-6">
          {outlets.map((o) => (
            <OutletBranchSettingsForm key={o.id} outlet={o} canEdit={canEditBranches} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileReadOnlyCard({ org, lines }: { org: GymDashboardOrganization; lines: string[] }) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-orange-500/20 bg-[#151515] p-6 text-zinc-100 lg:flex-row lg:items-start">
      <div className="shrink-0">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Logo</p>
        <GymLogoThumbnail logoUrl={org.logo_url} name={org.name} size="hero" />
      </div>
      <dl className="min-w-0 flex-1 space-y-5">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Name</dt>
          <dd className="mt-1 text-lg font-semibold text-zinc-50">{org.name}</dd>
          <dd className="mt-1 text-sm text-zinc-400">{org.slug}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">HQ address</dt>
          <dd className="mt-1 text-sm leading-relaxed text-zinc-200">
            {!lines.length ? (
              <span className="text-zinc-500">No structured address saved yet.</span>
            ) : (
              lines.map((line, index) => (
                <span key={`${index}-${line}`} className="block">
                  {line}
                </span>
              ))
            )}
          </dd>
        </div>
        {(org.contact_email || org.contact_phone) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {org.contact_email ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Contact email</dt>
                <dd className="mt-1 break-all text-sm text-zinc-200">{org.contact_email}</dd>
              </div>
            ) : null}
            {org.contact_phone ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Contact phone</dt>
                <dd className="mt-1 text-sm text-zinc-200">{org.contact_phone}</dd>
              </div>
            ) : null}
          </div>
        )}
      </dl>
    </div>
  );
}
