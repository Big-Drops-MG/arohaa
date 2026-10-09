"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { LeadFraudAssessment } from "@/features/data-export/model/interaction-log"

function badgeClass(label: LeadFraudAssessment["effectiveLabel"]): string {
  return label === "legit"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700"
}

export function LeadRiskBadge({
  fraud,
  className,
}: {
  fraud: LeadFraudAssessment | null | undefined
  className?: string
}) {
  if (!fraud) {
    return (
      <span
        className={cn(
          "inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600",
          className
        )}
      >
        —
      </span>
    )
  }

  const labelCopy = fraud.effectiveLabel === "legit" ? "Legit" : "Fraud"
  const title = [
    `Trust ${fraud.score}/100`,
    labelCopy,
    ...(fraud.reasons.length > 0
      ? ["", "Signals:", ...fraud.reasons.map((r) => `• ${r}`)]
      : []),
  ].join("\n")

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        badgeClass(fraud.effectiveLabel),
        className
      )}
    >
      {labelCopy}
      <span className="tabular-nums opacity-80">{fraud.score}</span>
    </span>
  )
}
