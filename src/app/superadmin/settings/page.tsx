import { EmptyState } from "@/components/ui/EmptyState";

/** Stub — hidden from superadmin nav until global platform config exists. Re-add to `layout.tsx` NAV when ready. */
export default function SuperadminSettingsPage() {
  return (
    <EmptyState
      title="Platform settings"
      description="Feature flags, email templates, and global limits belong here. Prefer a `platform_settings` table readable only by superadmins."
    />
  );
}
