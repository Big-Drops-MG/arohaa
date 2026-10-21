"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { LeadBehaviorSummary } from "@/features/data-export/model/data-export"

export function formatBehaviorDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s"
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`
}

function humanInputMode(b: LeadBehaviorSummary): string {
  const modes: string[] = []
  if (b.keyboardCount > 0) modes.push("keyboard")
  if (b.pointerCount > 0) modes.push("mouse")
  if (b.touchCount > 0) modes.push("touch")
  return modes.length > 0 ? modes.join(" + ") : "none"
}

function formToSubmitMs(b: LeadBehaviorSummary): number | null {
  if (b.formStartAt == null || b.formSubmitAt == null) return null
  const delta = b.formSubmitAt - b.formStartAt
  return Number.isFinite(delta) && delta >= 0 ? delta : null
}

function toneClass(b: LeadBehaviorSummary): string {
  const noHumanInput =
    b.keyboardCount === 0 && b.pointerCount === 0 && b.touchCount === 0
  if (noHumanInput || b.untrustedEventCount > b.trustedEventCount) {
    return "bg-rose-50 text-rose-700"
  }
  if (b.activeMs < 2_000) return "bg-amber-50 text-amber-800"
  return "bg-sky-50 text-sky-800"
}

export function behaviorDetailRows(
  b: LeadBehaviorSummary
): Array<{ label: string; value: string }> {
  const fill = formToSubmitMs(b)
  const rows: Array<{ label: string; value: string } | null> = [
    { label: "Visible time", value: formatBehaviorDuration(b.visibleMs) },
    { label: "Active time", value: formatBehaviorDuration(b.activeMs) },
    fill != null
      ? { label: "Form start to submit", value: formatBehaviorDuration(fill) }
      : null,
    { label: "Input mode", value: humanInputMode(b) },
    {
      label: "Keystrokes / pointer / touch",
      value: `${b.keyboardCount} / ${b.pointerCount} / ${b.touchCount}`,
    },
    {
      label: "Fields focused / inputs / changes",
      value: `${b.focusCount} / ${b.inputCount} / ${b.changeCount}`,
    },
    {
      label: "Paste / autofill hints",
      value: `${b.pasteCount} / ${b.autofillHints}`,
    },
    {
      label: "Trusted / untrusted events",
      value: `${b.trustedEventCount} / ${b.untrustedEventCount}`,
    },
    b.sdkInitMs != null
      ? { label: "SDK ready after", value: formatBehaviorDuration(b.sdkInitMs) }
      : null,
    b.reason ? { label: "Captured on", value: b.reason } : null,
    b.observedAt ? { label: "Observed at", value: b.observedAt } : null,
  ]
  return rows.filter((r): r is { label: string; value: string } => r != null)
}

export function buildBehaviorTitle(b: LeadBehaviorSummary): string {
  return behaviorDetailRows(b)
    .map((r) => `${r.label}: ${r.value}`)
    .join("\n")
}

export function LeadBehaviorDetails({
  behavior,
}: {
  behavior: LeadBehaviorSummary | null | undefined
}) {
  if (!behavior) {
    return <p className="text-xs text-muted-foreground">Not received</p>
  }
  return (
    <div className="space-y-2">
      <LeadBehaviorBadge behavior={behavior} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {behaviorDetailRows(behavior).map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-foreground tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function LeadBehaviorBadge({
  behavior,
  className,
}: {
  behavior: LeadBehaviorSummary | null | undefined
  className?: string
}) {
  if (!behavior) {
    return (
      <span
        title="No behavior summary received for this session"
        className={cn(
          "inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600",
          className
        )}
      >
        —
      </span>
    )
  }

  const fill = formToSubmitMs(behavior)
  return (
    <span
      title={buildBehaviorTitle(behavior)}
      className={cn(
        "inline-flex max-w-[12rem] flex-col gap-0.5 rounded-md px-2 py-1 text-xs font-medium",
        toneClass(behavior),
        className
      )}
    >
      <span className="tabular-nums">
        <span className="text-sm font-semibold tracking-tight">
          {formatBehaviorDuration(behavior.activeMs)}
        </span>
        <span className="opacity-70"> active</span>
        {fill != null ? (
          <span className="opacity-70">
            {" "}
            · {formatBehaviorDuration(fill)} form
          </span>
        ) : null}
      </span>
      <span className="leading-tight tabular-nums opacity-90">
        {behavior.keyboardCount} keys · {behavior.inputCount} inputs
        {behavior.pasteCount > 0 ? ` · ${behavior.pasteCount} paste` : ""}
        <span className="opacity-70"> · {humanInputMode(behavior)}</span>
      </span>
    </span>
  )
}
