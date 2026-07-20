"use client"

import { useEffect, useState } from "react"
import {
  formatDashboardDigitalClock,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

export function NavbarClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const label = now ? formatDashboardDigitalClock(now) : "--:--:-- -- ---"
  const zone = now ? getDashboardTimezoneAbbreviation(now) : null

  return (
    <time
      dateTime={now?.toISOString()}
      className="text-sm font-medium tracking-tight text-foreground tabular-nums"
      aria-live="off"
      aria-label={
        now ? `Current Eastern time ${label}` : "Current Eastern time"
      }
      title={zone ? `Eastern Time (${zone})` : "Eastern Time"}
    >
      {label}
    </time>
  )
}
