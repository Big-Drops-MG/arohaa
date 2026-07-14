import { formatDashboardDateTime } from "@/lib/datetime"

export function formatSettingsTimestamp(iso: string | null): string {
  if (!iso) return "—"
  return formatDashboardDateTime(iso)
}

export function formatLandingPageStatus(status: string): string {
  switch (status) {
    case "pending_verification":
      return "Pending verification"
    case "verified":
      return "Verified"
    case "archived":
      return "Archived"
    case "inactive":
      return "Inactive"
    default:
      return status
  }
}

export function formatSdkInstallStatus(status: string): string {
  switch (status) {
    case "waiting":
      return "Waiting"
    case "detected":
      return "Detected"
    case "failed":
      return "Failed"
    default:
      return status
  }
}

export function formatVerificationMethod(method: string | null): string {
  if (!method) return "—"
  if (method === "sdk_event") return "SDK event"
  if (method === "html_meta") return "HTML meta tag"
  return method
}
