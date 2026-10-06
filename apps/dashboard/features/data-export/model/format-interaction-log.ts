import { humanizeLeadFieldLabel } from "@/features/data-export/model/lead-field-columns"
import {
  formatInDashboardTimezone,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

export type InteractionLogKind =
  | "typed"
  | "pressed"
  | "clicked"
  | "changed"
  | "selected"
  | "lifecycle"
  | "unknown"

const KIND_BY_CODE: Record<number, InteractionLogKind> = {
  0: "typed",
  1: "pressed",
  2: "clicked",
  3: "changed",
  4: "selected",
  5: "lifecycle",
}

const KIND_LABEL: Record<InteractionLogKind, string> = {
  typed: "Typed",
  pressed: "Key",
  clicked: "Click",
  changed: "Changed",
  selected: "Selected",
  lifecycle: "Form",
  unknown: "Event",
}

export function resolveInteractionLogKind(
  kind: number | null | undefined
): InteractionLogKind {
  if (kind == null || !Number.isFinite(kind)) return "unknown"
  return KIND_BY_CODE[Math.trunc(kind)] ?? "unknown"
}

export function interactionLogKindLabel(
  kind: number | null | undefined
): string {
  return KIND_LABEL[resolveInteractionLogKind(kind)]
}

export function formatInteractionWhen(value: string): string {
  const d = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z"
  )
  if (Number.isNaN(d.getTime())) return value
  const formatted = formatInDashboardTimezone(d, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
  return `${formatted} ${getDashboardTimezoneAbbreviation(d)}`
}

export function formatInteractionOffset(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

function normalizeQuotedValue(raw: string): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  if (["true", "on", "yes", "y", "1"].includes(lower)) return "Yes"
  if (["false", "off", "no", "n", "0"].includes(lower)) return "No"
  return trimmed
}

/**
 * Turn SDK event messages into Leads-table-style readable copy.
 * Example: `typed 'a' in [first_name]` → `Typed 'a' in First Name`
 */
export function formatInteractionLogMessage(message: string): string {
  let out = message.trim()
  if (!out) return "—"

  out = out.replace(/\[([^\]]+)\]/g, (_match, key: string) =>
    humanizeLeadFieldLabel(String(key))
  )

  out = out.replace(
    /\b(changed value to|selected)\s+"([^"]*)"/gi,
    (_match, verb: string, value: string) =>
      `${verb} "${normalizeQuotedValue(value)}"`
  )

  out = out.replace(
    /\b(changed value to|selected)\s+'([^']*)'/gi,
    (_match, verb: string, value: string) =>
      `${verb} '${normalizeQuotedValue(value)}'`
  )

  out = out.replace(/\bunnamed\b/gi, "Unknown Control")

  out = out.replace(/^form started\b/i, "Form started")
  out = out.replace(/^form submitted\b/i, "Form submitted")
  out = out.replace(/^form completed\b/i, "Form completed")
  out = out.replace(/^step\s+(\d+)/i, (_m, n: string) => `Step ${n}`)

  if (/^[a-z]/.test(out)) {
    out = out.charAt(0).toUpperCase() + out.slice(1)
  }

  return out
}
