"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { LeadFraudAssessment } from "@/features/data-export/model/interaction-log"

function assessmentLabel(fraud: LeadFraudAssessment): string {
  if (!fraud.scoreAvailable || fraud.coverage === "insufficient") {
    return "Insufficient data"
  }
  if (fraud.effectiveLabel === "legit") return "Lower risk"
  return "Elevated risk"
}

function badgeClass(fraud: LeadFraudAssessment): string {
  if (!fraud.scoreAvailable || fraud.coverage === "insufficient") {
    return "bg-amber-50 text-amber-800"
  }
  return fraud.effectiveLabel === "legit"
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

  const labelCopy = assessmentLabel(fraud)
  const coverage =
    fraud.coverage === "sufficient"
      ? "Coverage sufficient"
      : fraud.coverage === "partial"
        ? "Coverage partial"
        : "Coverage insufficient"
  const title = [
    fraud.scoreAvailable && fraud.score != null
      ? `Trust ${fraud.score}/100`
      : "Trust unavailable",
    coverage,
    labelCopy,
    ...(fraud.findings.length > 0
      ? ["", "Findings:", ...fraud.findings.map((f) => `• ${f.detail}`)]
      : fraud.reasons.length > 0
        ? ["", "Signals:", ...fraud.reasons.map((r) => `• ${r}`)]
        : []),
  ].join("\n")

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        badgeClass(fraud),
        className
      )}
    >
      {labelCopy}
      {fraud.scoreAvailable && fraud.score != null ? (
        <span className="tabular-nums opacity-80">{fraud.score}</span>
      ) : null}
      <span className="opacity-70">· {fraud.coverage}</span>
    </span>
  )
}
