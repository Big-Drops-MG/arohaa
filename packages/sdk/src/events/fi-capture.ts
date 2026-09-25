import { track } from "../core/tracker"
import { getRemoteSealKey } from "../core/sdk-config"
import { sealJson } from "../crypto/seal"
import {
  resolveFormControl,
  resolveHeatmapFieldName,
} from "./form-field-key"
import { FI_EV, FI_MSG, FI_PROP } from "./fi-tokens"

type FiKind = 0 | 1 | 2 | 3

type FiItem = {
  t: number
  ts: number
  k: FiKind
  m: string
}

const MAX_VALUE_LEN = 500
const BATCH_SIZE = 25
const FLUSH_MS = 300
const MAX_BUFFER = 400
const CHANGE_DEBOUNCE_MS = 200

const MOD_KEYS = new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "OS",
  "Hyper",
  "Super",
])

let installed = false
let armed = false
let startedAt = 0
let formId: string | undefined
const buffer: FiItem[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let unloadFlushed = false
let inFlightItems: FiItem[] | null = null
const changeTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingChanges = new Map<string, string>()
const lastChangedValue = new Map<string, string>()

function bracket(name: string): string {
  return `[${name}]`
}

function formatTyped(key: string, field: string): string {
  return `${FI_MSG.typed} '${key}'${FI_MSG.inSep}${bracket(field)}`
}

function formatPressed(combo: string, field: string): string {
  return `${FI_MSG.pressed} '${combo}'${FI_MSG.inSep}${bracket(field)}`
}

function formatClicked(target: string): string {
  return `${FI_MSG.clickedOn} ${bracket(target)}`
}

function formatChanged(value: string, field: string): string {
  const safe = value.slice(0, MAX_VALUE_LEN)
  return `${FI_MSG.changedTo} "${safe}"${FI_MSG.inSep}${bracket(field)}`
}

function isSkippedControl(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null,
): boolean {
  if (!el) return true
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    if (t === "password" || t === "file" || t === "hidden") return true
  }
  return false
}

function resolveFieldLabel(target: EventTarget | null): string {
  const fromHeatmap = resolveHeatmapFieldName(target)
  if (fromHeatmap) return fromHeatmap

  const el = resolveFormControl(target)
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    if (t === "submit" || t === "button" || t === "image") {
      return (
        el.getAttribute("name")?.trim() ||
        el.id?.trim() ||
        el.value?.trim() ||
        t
      )
    }
  }
  return ""
}

function resolveClickLabel(target: EventTarget | null): string {
  if (!(target instanceof Element)) return FI_MSG.unnamed
  const control = resolveFormControl(target)
  if (control && !isSkippedControl(control)) {
    const field = resolveFieldLabel(control)
    if (field) return field
  }

  const el =
    target instanceof HTMLElement
      ? target
      : target.parentElement instanceof HTMLElement
        ? target.parentElement
        : null
  if (!el) return FI_MSG.unnamed

  const name =
    el.getAttribute("name")?.trim() ||
    el.id?.trim() ||
    el.getAttribute("aria-label")?.trim() ||
    (el instanceof HTMLInputElement || el instanceof HTMLButtonElement
      ? el.value?.trim()
      : "") ||
    el.getAttribute("data-arohaa-field")?.trim() ||
    ""

  if (name) return name.slice(0, 80)

  const tag = el.tagName.toLowerCase()
  return `${FI_MSG.unnamed} ${tag}`
}

function shortcutLabel(e: KeyboardEvent): string | null {
  if (MOD_KEYS.has(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push("Control")
  if (e.altKey) parts.push("Alt")
  if (e.metaKey) parts.push("Meta")
  if (e.shiftKey && e.key.length > 1) parts.push("Shift")

  const key = e.key === " " ? "Space" : e.key
  if (parts.length === 0) {
    if (key.length === 1) return null
    return key
  }
  parts.push(key)
  return parts.join("+")
}

function enqueueItem(kind: FiKind, message: string): void {
  if (!armed) return
  const now = Date.now()
  if (buffer.length >= MAX_BUFFER) buffer.shift()
  buffer.push({
    t: Math.max(0, now - startedAt),
    ts: now,
    k: kind,
    m: message,
  })
}

function pushItem(kind: FiKind, message: string): void {
  enqueueItem(kind, message)
  if (buffer.length >= BATCH_SIZE) {
    void flushBuffer()
    return
  }
  if (flushTimer == null) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      void flushBuffer()
    }, FLUSH_MS)
  }
}

function isPageHidden(): boolean {
  return (
    typeof document !== "undefined" && document.visibilityState === "hidden"
  )
}

/** Commit debounced value-change items into the buffer immediately. */
function drainChangeTimers(): void {
  for (const timer of changeTimers.values()) clearTimeout(timer)
  changeTimers.clear()
  for (const [field, value] of pendingChanges) {
    if (lastChangedValue.get(field) === value) continue
    lastChangedValue.set(field, value)
    enqueueItem(3, formatChanged(value, field))
  }
  pendingChanges.clear()
}

function trackFiBatch(items: FiItem[]): void {
  if (items.length === 0) return
  track(FI_EV, {
    v: 1,
    s: startedAt,
    f: formId,
    i: items,
  })
}

/**
 * Unload-safe flush: sendBeacon cannot wait for WebCrypto.
 * Send plaintext items for server-side seal when the page is hiding.
 */
function flushBufferUrgent(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  drainChangeTimers()

  const pending: FiItem[] = []
  if (inFlightItems && inFlightItems.length > 0) {
    pending.push(...inFlightItems)
    inFlightItems = null
  }
  if (buffer.length > 0) {
    pending.push(...buffer.splice(0, buffer.length))
  }
  if (pending.length === 0 || unloadFlushed) return
  unloadFlushed = true
  trackFiBatch(pending)
}

async function flushBuffer(): Promise<void> {
  if (flushing || unloadFlushed) return
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return

  // Page already hiding — use sync beacon path (no await).
  if (isPageHidden()) {
    flushBufferUrgent()
    return
  }

  const keyB64 = getRemoteSealKey()
  if (!keyB64) {
    // Keep buffer — seal key may still arrive; urgent unload will server-seal.
    return
  }

  flushing = true
  const items = buffer.splice(0, buffer.length)
  inFlightItems = items
  try {
    if (unloadFlushed) return
    const sealed = await sealJson(keyB64, {
      v: 1,
      s: startedAt,
      f: formId,
      i: items,
    })
    if (unloadFlushed) return
    if (sealed) {
      track(FI_EV, { [FI_PROP]: sealed })
    } else {
      trackFiBatch(items)
    }
  } catch {
    if (!unloadFlushed) trackFiBatch(items)
  } finally {
    if (inFlightItems === items) inFlightItems = null
    flushing = false
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (!armed) return
  const control = resolveFormControl(e.target)
  if (isSkippedControl(control)) return

  const field = resolveFieldLabel(e.target) || FI_MSG.unnamed
  const combo = shortcutLabel(e)
  if (combo) {
    pushItem(1, formatPressed(combo, field))
    return
  }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    pushItem(0, formatTyped(e.key, field))
  }
}

function onClick(e: MouseEvent): void {
  if (!armed) return
  const control = resolveFormControl(e.target)
  if (control && isSkippedControl(control)) return
  pushItem(2, formatClicked(resolveClickLabel(e.target)))
}

function scheduleChange(
  field: string,
  value: string,
): void {
  pendingChanges.set(field, value)
  const prev = changeTimers.get(field)
  if (prev) clearTimeout(prev)
  changeTimers.set(
    field,
    setTimeout(() => {
      changeTimers.delete(field)
      pendingChanges.delete(field)
      if (lastChangedValue.get(field) === value) return
      lastChangedValue.set(field, value)
      pushItem(3, formatChanged(value, field))
    }, CHANGE_DEBOUNCE_MS),
  )
}

function onInputOrChange(e: Event): void {
  if (!armed) return
  const control = resolveFormControl(e.target)
  if (!control || isSkippedControl(control)) return
  const field = resolveFieldLabel(control) || FI_MSG.unnamed
  const value =
    control instanceof HTMLSelectElement
      ? control.value
      : "value" in control
        ? String((control as HTMLInputElement | HTMLTextAreaElement).value)
        : ""
  scheduleChange(field, value)
}

function onPageHide(): void {
  flushBufferUrgent()
}

export function armFiCapture(nextFormId?: string): void {
  if (!armed) {
    armed = true
    startedAt = Date.now()
    unloadFlushed = false
  }
  if (nextFormId) formId = nextFormId
}

export function setupFiCapture(): void {
  if (installed || typeof document === "undefined") return
  installed = true

  document.addEventListener("keydown", onKeyDown, true)
  document.addEventListener("click", onClick, true)
  document.addEventListener("input", onInputOrChange, true)
  document.addEventListener("change", onInputOrChange, true)
  window.addEventListener("pagehide", onPageHide, true)
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        onPageHide()
      } else {
        unloadFlushed = false
      }
    },
    true,
  )
}

/** Test helpers — message builders only. */
export const __fiTest = {
  formatTyped,
  formatPressed,
  formatClicked,
  formatChanged,
  shortcutLabel,
  resolveClickLabel,
}
