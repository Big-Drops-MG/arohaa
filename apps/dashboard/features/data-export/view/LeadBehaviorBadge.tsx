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

export function buildBehaviorTitle(b: LeadBehaviorSummary): string {
  const fill = formToSubmitMs(b)
  return [
    `Visible ${formatBehaviorDuration(b.visibleMs)} · Active ${formatBehaviorDuration(b.activeMs)}`,
    fill != null
      ? `Form start to submit: ${formatBehaviorDuration(fill)}`
      : null,
    `Input: ${humanInputMode(b)}`,
    `Keystrokes ${b.keyboardCount} · Pointer ${b.pointerCount} · Touch ${b.touchCount}`,
    `Fields focused ${b.focusCount} · Inputs ${b.inputCount} · Changes ${b.changeCount}`,
    `Paste ${b.pasteCount} · Autofill hints ${b.autofillHints}`,
    `Trusted events ${b.trustedEventCount} · Untrusted ${b.untrustedEventCount}`,
    b.sdkInitMs != null
      ? `SDK ready after ${formatBehaviorDuration(b.sdkInitMs)}`
      : null,
    b.reason ? `Captured on: ${b.reason}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n")
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
