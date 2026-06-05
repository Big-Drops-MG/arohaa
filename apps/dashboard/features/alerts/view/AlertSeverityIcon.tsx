import { AlertTriangle, Bell, CircleAlert } from "lucide-react"
import type { OverviewAlertSeverity } from "@/features/overview/model/overview"

type AlertSeverityIconProps = {
  severity: OverviewAlertSeverity
  className?: string
}

export function AlertSeverityIcon({
  severity,
  className = "size-4 shrink-0",
}: AlertSeverityIconProps) {
  if (severity === "warning") {
    return (
      <AlertTriangle className={`${className} text-orange-600`} aria-hidden />
    )
  }

  if (severity === "alert") {
    return <Bell className={`${className} text-sky-600`} aria-hidden />
  }

  return <CircleAlert className={`${className} text-red-600`} aria-hidden />
}
