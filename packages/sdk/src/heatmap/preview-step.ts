const PREVIEW_STEP_INTERVAL_MS = 400
const PREREQUISITE_MAX_ANSWERS = 4
const PREREQUISITE_WAIT_MS = 3000
const PREREQUISITE_POLL_MS = 120

let previewStepSlug: string | null = null
let previewStepTimer: number | null = null
let previewStepOnChange: (() => void) | null = null
let prerequisiteSlug: string | null = null
let forcingPaused = false
let prefillState: Record<string, unknown> = { stage: "idle" }

export function heatmapPrefillState(): Record<string, unknown> {
  return prefillState
}

function normalizeStepSlug(raw: string): string {
  return raw.replace(/^#\/?/, "").trim().toLowerCase()
}

function stepNodes(): HTMLElement[] {
  const preferred = document.querySelectorAll<HTMLElement>(
    ".step.carousel-item[data-step], .carousel-item[data-step]"
  )
  if (preferred.length > 0) return Array.from(preferred)
  return Array.from(document.querySelectorAll<HTMLElement>("[data-step]"))
}

function slugOf(el: HTMLElement): string {
  return (el.getAttribute("data-step") || "").trim().toLowerCase()
}

function findStepNode(slug: string): HTMLElement | null {
  return stepNodes().find((el) => slugOf(el) === slug) ?? null
}

function isSearchField(el: HTMLInputElement): boolean {
  const hint = `${el.name} ${el.id} ${el.placeholder}`.toLowerCase()
  return el.type === "search" || /search|filter/.test(hint)
}

// A step whose choices are fetched from earlier answers renders as an empty
// shell until those answers exist, so control count is what tells the two apart.
function answerableControlCount(panel: HTMLElement): number {
  let count = 0
  for (const el of panel.querySelectorAll<HTMLElement>(
    "input, select, textarea, button"
  )) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden") continue
      if (isSearchField(el)) continue
    }
    count += 1
  }
  return count
}

function isAwaitingPrerequisites(slug: string): boolean {
  const panel = findStepNode(slug)
  if (!panel) return false
  return answerableControlCount(panel) === 0
}

// Only radio choices are ever answered automatically: they carry no typed data
// and never submit the funnel.
function nextPrerequisiteChoice(slug: string): HTMLElement | null {
  const nodes = stepNodes()
  const targetIndex = nodes.findIndex((el) => slugOf(el) === slug)
  if (targetIndex <= 0) return null

  for (let i = 0; i < targetIndex; i += 1) {
    const panel = nodes[i]
    if (!panel) continue
    const radios = Array.from(
      panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    )
    if (radios.length === 0) continue
    if (radios.some((radio) => radio.checked)) continue

    const first = radios[0]
    if (!first) continue
    if (first.id) {
      const label = panel.querySelector<HTMLElement>(
        `label[for="${CSS.escape(first.id)}"]`
      )
      if (label) return label
    }
    return first
  }

  return null
}

function waitForStepContent(slug: string): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const poll = window.setInterval(() => {
      const ready = !isAwaitingPrerequisites(slug)
      if (ready || Date.now() - startedAt > PREREQUISITE_WAIT_MS) {
        window.clearInterval(poll)
        resolve()
      }
    }, PREREQUISITE_POLL_MS)
  })
}

function releaseForcedDisplay(): void {
  for (const el of stepNodes()) {
    el.style.removeProperty("display")
  }
}

async function answerPrerequisites(slug: string): Promise<boolean> {
  if (prerequisiteSlug === slug) return false
  prerequisiteSlug = slug

  const panel = findStepNode(slug)
  prefillState = {
    stage: "checked",
    slug,
    steps: stepNodes().length,
    controls: panel ? answerableControlCount(panel) : -1,
  }

  if (!isAwaitingPrerequisites(slug)) {
    prefillState = { ...prefillState, stage: "not-awaiting" }
    return false
  }

  forcingPaused = true
  releaseForcedDisplay()

  let answered = 0
  while (answered < PREREQUISITE_MAX_ANSWERS && isAwaitingPrerequisites(slug)) {
    const choice = nextPrerequisiteChoice(slug)
    if (!choice) {
      prefillState = { ...prefillState, stage: "no-choice", answered }
      break
    }
    choice.click()
    answered += 1
    await waitForStepContent(slug)
    const now = findStepNode(slug)
    prefillState = {
      ...prefillState,
      stage: "answered",
      answered,
      controlsNow: now ? answerableControlCount(now) : -1,
    }
  }

  forcingPaused = false
  if (answered === 0) return false

  applyHeatmapPreviewStep(slug)
  return true
}

export function applyHeatmapPreviewStep(slugRaw: string): {
  matched: boolean
  changed: boolean
} {
  const slug = normalizeStepSlug(slugRaw)
  if (!slug || slug === "start") return { matched: false, changed: false }
  if (forcingPaused) return { matched: false, changed: false }

  const nodes = stepNodes()
  if (nodes.length === 0) return { matched: false, changed: false }

  let matched = false
  let changed = false

  for (const el of nodes) {
    const on = slugOf(el) === slug
    if (on) matched = true

    const desired = on ? "block" : "none"
    if (el.style.display !== desired) {
      el.style.setProperty("display", desired, "important")
      changed = true
    }
    if (el.classList.contains("active") !== on) {
      el.classList.toggle("active", on)
      changed = true
    }
  }

  if (!matched) return { matched: false, changed }

  if (changed) {
    try {
      const nextHash = `#/${slug}`
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash)
      }
    } catch {
      /* history is unavailable in some sandboxes */
    }
  }

  return { matched, changed }
}

export function startHeatmapPreviewStep(
  slugRaw: string,
  onChange?: () => void
): boolean {
  const slug = normalizeStepSlug(slugRaw)
  if (!slug || slug === "start") {
    clearHeatmapPreviewStep()
    return false
  }

  if (previewStepSlug !== slug) {
    previewStepSlug = slug
    prerequisiteSlug = null
  }
  if (onChange) previewStepOnChange = onChange

  const { matched, changed } = applyHeatmapPreviewStep(slug)

  if (matched && prerequisiteSlug !== slug) {
    void answerPrerequisites(slug).then((filled) => {
      if (filled) previewStepOnChange?.()
    })
  }

  if (previewStepTimer == null) {
    previewStepTimer = window.setInterval(() => {
      if (!previewStepSlug) return
      const result = applyHeatmapPreviewStep(previewStepSlug)
      if (result.changed) previewStepOnChange?.()
    }, PREVIEW_STEP_INTERVAL_MS)
  }

  return changed
}

export function clearHeatmapPreviewStep(): void {
  previewStepSlug = null
  previewStepOnChange = null
  prerequisiteSlug = null
  forcingPaused = false
  if (previewStepTimer != null) {
    window.clearInterval(previewStepTimer)
    previewStepTimer = null
  }

  releaseForcedDisplay()
}
