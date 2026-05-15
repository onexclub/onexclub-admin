import { EmptyState } from "@/components/ui/EmptyState";

export default function SuperadminSettingsPage() {
  return (
    <EmptyState
      title="Platform settings"
      description="Feature flags, email templates, and global limits belong here. Prefer a `platform_settings` table readable only by superadmins."
    />
  );
}
