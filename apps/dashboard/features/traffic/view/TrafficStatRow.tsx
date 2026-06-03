"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { TrafficKpi } from "@/features/traffic/model/traffic-kpis"

const statCardShellClassName =
  "rounded-[15px] border px-4 py-4 text-left shadow-xs"

const statLabelClassName = "text-xs font-medium"
const statValueClassName =
  "mt-2 font-heading text-xl font-semibold tracking-tight tabular-nums"

type TrafficStatCardProps = {
  label: string
  value: string
  variant?: "primary" | "default"
}

function TrafficStatCard({
  label,
  value,
  variant = "default",
}: TrafficStatCardProps) {
  const isPrimary = variant === "primary"

  return (
    <div
      className={cn(
        statCardShellClassName,
        isPrimary
          ? "border-black bg-black text-white"
          : "border-foreground/10 bg-card text-foreground"
      )}
    >
      <p
        className={cn(
          statLabelClassName,
          isPrimary ? "text-white/80" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          statValueClassName,
          isPrimary ? "text-white" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}

type TrafficStatRowProps = {
  activeUsersNow: string
  kpis: TrafficKpi[]
}

export function TrafficStatRow({ activeUsersNow, kpis }: TrafficStatRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <TrafficStatCard
        label="Active Users Right Now"
        value={activeUsersNow}
        variant="primary"
      />
      {kpis.map((kpi) => (
        <TrafficStatCard key={kpi.id} label={kpi.label} value={kpi.value} />
      ))}
    </div>
  )
}
