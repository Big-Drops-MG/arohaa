import type { LeadBehaviorSummary } from "@/features/data-export/model/data-export"

function nonNegativeInt(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pick(row: Record<string, unknown>, camel: string, snake: string) {
  return row[camel] !== undefined ? row[camel] : row[snake]
}

export function mapLeadBehaviorSummary(
  raw: unknown
): LeadBehaviorSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const visible = pick(row, "visibleMs", "visible_ms")
  const active = pick(row, "activeMs", "active_ms")
  if (visible == null && active == null) return null
  return {
    reason: String(row.reason ?? ""),
    observedAt: String(pick(row, "observedAt", "observed_at") ?? ""),
    visibleMs: nonNegativeInt(visible),
    activeMs: nonNegativeInt(active),
    focusCount: nonNegativeInt(pick(row, "focusCount", "focus_count")),
    inputCount: nonNegativeInt(pick(row, "inputCount", "input_count")),
    changeCount: nonNegativeInt(pick(row, "changeCount", "change_count")),
    pasteCount: nonNegativeInt(pick(row, "pasteCount", "paste_count")),
    autofillHints: nonNegativeInt(pick(row, "autofillHints", "autofill_hints")),
    pointerCount: nonNegativeInt(pick(row, "pointerCount", "pointer_count")),
    touchCount: nonNegativeInt(pick(row, "touchCount", "touch_count")),
    keyboardCount: nonNegativeInt(pick(row, "keyboardCount", "keyboard_count")),
    trustedEventCount: nonNegativeInt(
      pick(row, "trustedEventCount", "trusted_event_count")
    ),
    untrustedEventCount: nonNegativeInt(
      pick(row, "untrustedEventCount", "untrusted_event_count")
    ),
    formStartAt: nullableNumber(pick(row, "formStartAt", "form_start_at")),
    formSubmitAt: nullableNumber(pick(row, "formSubmitAt", "form_submit_at")),
    sdkInitMs: nullableNumber(pick(row, "sdkInitMs", "sdk_init_ms")),
  }
}
