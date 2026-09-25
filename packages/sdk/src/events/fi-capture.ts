import { track } from "../core/tracker"
import { getRemoteSealKey } from "../core/sdk-config"
import { getIdentity } from "../model/identity"
import { getItem, setItem } from "../services/storage.service"
import { sealJson } from "../crypto/seal"
import {
  resolveFormControl,
  resolveHeatmapFieldName,
} from "./form-field-key"
import { FI_EV, FI_MSG, FI_PROP } from "./fi-tokens"

type FiKind = 0 | 1 | 2 | 3 | 4 | 5

type FiItem = {
  t: number
  ts: number
  k: FiKind
  m: string
}

const MAX_VALUE_LEN = 500
const MAX_LABEL_LEN = 80
const BATCH_SIZE = 25
const FLUSH_MS = 300
const MAX_BUFFER = 800
const CHANGE_DEBOUNCE_MS = 200
const META_KEY = "aro_fi_meta"

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
let loggedFormStart = false
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

function formatSelected(value: string, field: string): string {
  const safe = value.slice(0, MAX_VALUE_LEN)
  return `${FI_MSG.selected} "${safe}"${FI_MSG.inSep}${bracket(field)}`
}

function formatStep(kind: "viewed" | "completed", stepIndex: number, stepName?: string): string {
  const label = stepName?.trim()
    ? `${stepIndex}:${stepName.trim().slice(0, 40)}`
    : String(stepIndex)
  const verb = kind === "viewed" ? FI_MSG.viewed : FI_MSG.completed
  return `${FI_MSG.step} ${label} ${verb}`
}

function cleanLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LEN)
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

function fieldKeyFromControl(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string {
  const fromHeatmap = resolveHeatmapFieldName(el)
  if (fromHeatmap) return fromHeatmap

  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    if (t === "submit" || t === "button" || t === "image" || t === "radio" || t === "checkbox") {
      return (
        el.getAttribute("name")?.trim() ||
        el.id?.trim() ||
        el.getAttribute("data-arohaa-field")?.trim() ||
        el.value?.trim() ||
        t
      )
    }
  }

  return (
    el.getAttribute("data-arohaa-field")?.trim() ||
    el.getAttribute("name")?.trim() ||
    el.id?.trim() ||
    ""
  )
}

function resolveFieldLabel(target: EventTarget | null): string {
  const el = resolveFormControl(target)
  if (!el || isSkippedControl(el)) return ""
  return fieldKeyFromControl(el)
}

function readableNodeLabel(el: Element): string {
  const named =
    el.getAttribute("data-arohaa-field")?.trim() ||
    el.getAttribute("name")?.trim() ||
    el.id?.trim() ||
    el.getAttribute("aria-label")?.trim() ||
    el.getAttribute("data-value")?.trim() ||
    el.getAttribute("value")?.trim() ||
    ""
  if (named) return cleanLabel(named)

  if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
    const v = el.value?.trim()
    if (v) return cleanLabel(v)
  }

  const text = cleanLabel(el.textContent || "")
  if (text) return text

  return `${FI_MSG.unnamed} ${el.tagName.toLowerCase()}`
}

function resolveClickLabel(target: EventTarget | null): string {
  if (!(target instanceof Element)) return FI_MSG.unnamed

  const control = resolveFormControl(target)
  if (control && !isSkippedControl(control)) {
    const field = fieldKeyFromControl(control)
    if (field) return field
  }

  const interesting =
    target.closest(
      '[role="option"], [role="radio"], [role="checkbox"], [role="button"], label, button, a, li, [data-arohaa-field], [data-arohaa-step], [data-value]',
    ) ?? (target instanceof HTMLElement ? target : target.parentElement)

  if (!(interesting instanceof Element)) return FI_MSG.unnamed
  return readableNodeLabel(interesting)
}

function controlDisplayValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string {
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions?.[0]
    const text = cleanLabel(opt?.textContent || "")
    return text || el.value
  }
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    if (t === "checkbox") return el.checked ? el.value || "true" : "false"
    if (t === "radio") return el.checked ? el.value || "true" : ""
  }
  return "value" in el ? String(el.value) : ""
}

function isChoiceControl(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  if (el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    return t === "checkbox" || t === "radio"
  }
  return false
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

function isFormLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      "form, [data-arohaa-form], [data-arohaa-zip-form], [data-arohaa-field], [data-arohaa-step], [data-arohaa-zip], input, textarea, select, label, [role='option'], [role='radio'], [role='checkbox']",
    ),
  )
}

function persistMeta(): void {
  try {
    const sid = getIdentity().sid
    setItem(
      META_KEY,
      JSON.stringify({ sid, startedAt, formId: formId ?? null }),
    )
  } catch {
    /* ignore */
  }
}

function restoreMeta(): void {
  try {
    const raw = getItem(META_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      sid?: string
      startedAt?: number
      formId?: string | null
    }
    const sid = getIdentity().sid
    if (parsed.sid !== sid) return
    if (typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt)) {
      startedAt = parsed.startedAt
    }
    if (typeof parsed.formId === "string" && parsed.formId) {
      formId = parsed.formId
    }
  } catch {
    /* ignore */
  }
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

  if (isPageHidden()) {
    flushBufferUrgent()
    return
  }

  const keyB64 = getRemoteSealKey()
  if (!keyB64) return

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

function ensureArmed(target?: EventTarget | null, nextFormId?: string): void {
  if (!armed) {
    if (target && !isFormLikeTarget(target) && !nextFormId) return
    restoreMeta()
    armed = true
    if (!startedAt) startedAt = Date.now()
    unloadFlushed = false
  }
  if (nextFormId) formId = nextFormId
  persistMeta()

  if (!loggedFormStart) {
    loggedFormStart = true
    const label = formId ? ` (${formId})` : ""
    pushItem(5, `${FI_MSG.formStarted}${label}`)
  }
}

function onKeyDown(e: KeyboardEvent): void {
  ensureArmed(e.target)
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
  ensureArmed(e.target)
  if (!armed) return
  const control = resolveFormControl(e.target)
  if (control && isSkippedControl(control)) return

  const label = resolveClickLabel(e.target)
  pushItem(2, formatClicked(label))

  if (control && !isSkippedControl(control) && isChoiceControl(control)) {
    const field = fieldKeyFromControl(control) || FI_MSG.unnamed
    const value = controlDisplayValue(control)
    if (value) {
      pushItem(4, formatSelected(value, field))
      lastChangedValue.set(field, value)
    }
  } else if (e.target instanceof Element) {
    const optionish = e.target.closest(
      '[role="option"], [role="radio"], [data-value]',
    )
    if (optionish instanceof Element) {
      const field =
        optionish.getAttribute("name")?.trim() ||
        optionish.closest("[data-arohaa-field], [name], [id]")?.getAttribute("data-arohaa-field") ||
        optionish.closest("[name]")?.getAttribute("name") ||
        FI_MSG.unnamed
      const value =
        optionish.getAttribute("data-value")?.trim() ||
        optionish.getAttribute("aria-label")?.trim() ||
        cleanLabel(optionish.textContent || "")
      if (value) pushItem(4, formatSelected(value, field || FI_MSG.unnamed))
    }
  }
}

function scheduleChange(field: string, value: string, selected: boolean): void {
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
      pushItem(selected ? 4 : 3, selected ? formatSelected(value, field) : formatChanged(value, field))
    }, CHANGE_DEBOUNCE_MS),
  )
}

function onInputOrChange(e: Event): void {
  ensureArmed(e.target)
  if (!armed) return
  const control = resolveFormControl(e.target)
  if (!control || isSkippedControl(control)) return
  const field = fieldKeyFromControl(control) || FI_MSG.unnamed
  const value = controlDisplayValue(control)
  scheduleChange(field, value, isChoiceControl(control))
}

function onPageHide(): void {
  flushBufferUrgent()
}

export function armFiCapture(nextFormId?: string): void {
  ensureArmed(null, nextFormId)
}

export function markFiFormSubmit(formIdValue?: string): void {
  ensureArmed(null, formIdValue)
  if (!armed) return
  const label = formIdValue || formId
  pushItem(5, label ? `${FI_MSG.formSubmitted} (${label})` : FI_MSG.formSubmitted)
  void flushBuffer()
}

export function markFiFormComplete(formIdValue?: string): void {
  ensureArmed(null, formIdValue)
  if (!armed) return
  const label = formIdValue || formId
  pushItem(5, label ? `${FI_MSG.formCompleted} (${label})` : FI_MSG.formCompleted)
  flushBufferUrgent()
}

export function markFiStepView(stepIndex: number, stepName?: string): void {
  if (!armed) ensureArmed(null)
  if (!armed) return
  pushItem(5, formatStep("viewed", stepIndex, stepName))
}

export function markFiStepComplete(stepIndex: number, stepName?: string): void {
  if (!armed) ensureArmed(null)
  if (!armed) return
  pushItem(5, formatStep("completed", stepIndex, stepName))
  void flushBuffer()
}

export function setupFiCapture(): void {
  if (installed || typeof document === "undefined") return
  installed = true
  restoreMeta()

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

export const __fiTest = {
  formatTyped,
  formatPressed,
  formatClicked,
  formatChanged,
  formatSelected,
  formatStep,
  shortcutLabel,
  resolveClickLabel,
}
