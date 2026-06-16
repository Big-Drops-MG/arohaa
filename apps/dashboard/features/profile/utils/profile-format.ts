import { formatSettingsTimestamp } from "@/features/settings/utils/settings-format"

export function formatEmailVerified(iso: string | null): string {
  if (!iso) return "Not verified"
  return formatSettingsTimestamp(iso)
}

export function formatTwoFactorStatus(enabled: boolean): string {
  return enabled ? "Enabled" : "Disabled"
}
