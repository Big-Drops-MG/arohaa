import { track } from "../core/tracker"
import { getSdkInitStartedAt } from "../core/init-timing"

type BehaviorSummary = {
  v: number
  visible_ms: number
  active_ms: number
  form_start_at: number | null
  form_submit_at: number | null
  focus_count: number
  input_count: number
  change_count: number
  selection_count: number
  paste_count: number
  autofill_hints: number
  pointer_count: number
  touch_count: number
  keyboard_count: number
  trusted_event_count: number
  untrusted_event_count: number
  sdk_init_ms: number | null
  coverage_gaps: string[]
}

const SUMMARY_VERSION = 1
const ACTIVE_IDLE_MS = 5_000

let installed = false
let visibleStarted = 0
let wasVisible = false
let activeStarted = 0
let visibleMs = 0
let activeMs = 0
let formStartAt: number | null = null
let formSubmitAt: number | null = null
let focusCount = 0
let inputCount = 0
let changeCount = 0
let selectionCount = 0
let pasteCount = 0
let autofillHints = 0
let pointerCount = 0
let touchCount = 0
let keyboardCount = 0
let trustedEventCount = 0
let untrustedEventCount = 0
let lastEmitAt = 0
let lastInteractionAt = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null
let coverageGaps: string[] = []

function noteTrusted(e: Event): void {
  if (typeof e.isTrusted === "boolean") {
    if (e.isTrusted) trustedEventCount += 1
    else untrustedEventCount += 1
  } else if (!coverageGaps.includes("isTrusted")) {
    coverageGaps.push("isTrusted")
  }
}

function flushVisibleInterval(now: number): void {
  if (wasVisible && visibleStarted > 0) {
    visibleMs += Math.max(0, now - visibleStarted)
  }
  visibleStarted = 0
}

function onVisibilityChange(nextVisible?: boolean): void {
  const now = Date.now()
  const nowVisible =
    typeof nextVisible === "boolean"
      ? nextVisible
      : typeof document !== "undefined"
        ? document.visibilityState === "visible"
        : wasVisible
  if (wasVisible && !nowVisible) {
    flushVisibleInterval(now)
    endActiveSegment(now)
  } else if (!wasVisible && nowVisible) {
    visibleStarted = now
  }
  wasVisible = nowVisible
}

function endActiveSegment(now = Date.now()): void {
  if (activeStarted > 0) {
    const end = Math.min(now, lastInteractionAt + ACTIVE_IDLE_MS)
    activeMs += Math.max(0, end - activeStarted)
    activeStarted = 0
  }
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function noteInteraction(): void {
  const now = Date.now()
  lastInteractionAt = now
  if (activeStarted <= 0) activeStarted = now
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    endActiveSegment(Date.now())
  }, ACTIVE_IDLE_MS)
}

function finalizeTiming(): void {
  const now = Date.now()
  if (wasVisible) flushVisibleInterval(now)
  endActiveSegment(now)
  if (wasVisible) {
    visibleStarted = now
  }
}

function buildSummary(): BehaviorSummary {
  finalizeTiming()
  const initAt = getSdkInitStartedAt()
  return {
    v: SUMMARY_VERSION,
    visible_ms: visibleMs,
    active_ms: activeMs,
    form_start_at: formStartAt,
    form_submit_at: formSubmitAt,
    focus_count: focusCount,
    input_count: inputCount,
    change_count: changeCount,
    selection_count: selectionCount,
    paste_count: pasteCount,
    autofill_hints: autofillHints,
    pointer_count: pointerCount,
    touch_count: touchCount,
    keyboard_count: keyboardCount,
    trusted_event_count: trustedEventCount,
    untrusted_event_count: untrustedEventCount,
    sdk_init_ms: initAt > 0 ? Date.now() - initAt : null,
    coverage_gaps: [...coverageGaps],
  }
}

export function emitBehaviorSummary(reason: string): void {
  const now = Date.now()
  if (reason !== "submit" && reason !== "leave" && now - lastEmitAt < 5_000) {
    return
  }
  lastEmitAt = now
  track("behavior_summary", {
    reason,
    ...buildSummary(),
  })
}

export function markBehaviorFormStart(): void {
  if (!formStartAt) formStartAt = Date.now()
}

export function markBehaviorFormSubmit(): void {
  formSubmitAt = Date.now()
  if (!formStartAt) formStartAt = formSubmitAt
  emitBehaviorSummary("submit")
}

export function setupBehaviorSummary(): void {
  if (installed || typeof document === "undefined") return
  installed = true
  wasVisible = document.visibilityState === "visible"
  visibleStarted = wasVisible ? Date.now() : 0

  document.addEventListener(
    "visibilitychange",
    () => {
      const hidden = document.visibilityState === "hidden"
      onVisibilityChange(!hidden)
      if (hidden) {
        emitBehaviorSummary("hidden")
      }
    },
    true,
  )

  window.addEventListener(
    "pagehide",
    () => {
      emitBehaviorSummary("leave")
    },
    true,
  )

  document.addEventListener(
    "focusin",
    (e) => {
      noteTrusted(e)
      focusCount += 1
      noteInteraction()
    },
    true,
  )
  document.addEventListener(
    "input",
    (e) => {
      noteTrusted(e)
      inputCount += 1
      noteInteraction()
      if (e instanceof InputEvent && e.inputType === "insertReplacementText") {
        autofillHints += 1
      }
    },
    true,
  )
  document.addEventListener(
    "change",
    (e) => {
      noteTrusted(e)
      changeCount += 1
      noteInteraction()
    },
    true,
  )
  document.addEventListener(
    "select",
    (e) => {
      noteTrusted(e)
      selectionCount += 1
    },
    true,
  )
  document.addEventListener(
    "paste",
    (e) => {
      noteTrusted(e)
      pasteCount += 1
      noteInteraction()
    },
    true,
  )
  document.addEventListener(
    "pointerdown",
    (e) => {
      noteTrusted(e)
      pointerCount += 1
      noteInteraction()
    },
    true,
  )
  document.addEventListener(
    "touchstart",
    (e) => {
      noteTrusted(e)
      touchCount += 1
      noteInteraction()
    },
    true,
  )
  document.addEventListener(
    "keydown",
    (e) => {
      noteTrusted(e)
      keyboardCount += 1
      noteInteraction()
    },
    true,
  )
}

export const __behaviorTimingTest = {
  reset() {
    installed = false
    visibleStarted = 0
    wasVisible = false
    activeStarted = 0
    visibleMs = 0
    activeMs = 0
    lastInteractionAt = 0
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
  },
  onVisibilityChange,
  noteInteraction,
  endActiveSegment,
  getVisibleMs: () => visibleMs,
  getActiveMs: () => activeMs,
  setWasVisible: (v: boolean) => {
    wasVisible = v
  },
  setVisibleStarted: (n: number) => {
    visibleStarted = n
  },
  ACTIVE_IDLE_MS,
}
