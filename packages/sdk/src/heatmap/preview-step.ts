const PREVIEW_STEP_INTERVAL_MS = 400
const PREFILL_MAX_ANSWERS = 12
const PREFILL_DEADLINE_MS = 25000
const PREFILL_PROGRESS_MS = 1400
const PREFILL_POLL_MS = 120

let previewStepSlug: string | null = null
let previewStepTimer: number | null = null
let previewStepOnChange: (() => void) | null = null
let prefilledSlug: string | null = null
let forcingPaused = false

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


function needsPrefill(slug: string): boolean {
  const panel = findStepNode(slug)
  if (!panel) return true
  return answerableControlCount(panel) === 0
}


function nextUnansweredChoice(): HTMLElement | null {
  for (const panel of stepNodes()) {
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

function funnelSignature(): string {
  const nodes = stepNodes()
  let radios = 0
  let checked = 0
  for (const el of nodes) {
    const found = el.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    radios += found.length
    for (const radio of found) {
      if (radio.checked) checked += 1
    }
  }
  return `${nodes.length}:${radios}:${checked}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}


function waitForProgress(slug: string, since: string): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const poll = window.setInterval(() => {
      const done =
        !needsPrefill(slug) ||
        funnelSignature() !== since ||
        Date.now() - startedAt > PREFILL_PROGRESS_MS
      if (done) {
        window.clearInterval(poll)
        resolve()
      }
    }, PREFILL_POLL_MS)
  })
}

function releaseForcedDisplay(): void {
  for (const el of stepNodes()) {
    el.style.removeProperty("display")
  }
}

async function prefillForStep(slug: string): Promise<boolean> {
  if (prefilledSlug === slug) return false
  prefilledSlug = slug
  if (!needsPrefill(slug)) return false

  const deadline = Date.now() + PREFILL_DEADLINE_MS
  let answered = 0

  while (
    answered < PREFILL_MAX_ANSWERS &&
    Date.now() < deadline &&
    needsPrefill(slug)
  ) {
    const choice = nextUnansweredChoice()
    if (!choice) {
      await delay(PREFILL_POLL_MS)
      continue
    }


    forcingPaused = true
    releaseForcedDisplay()
    choice.click()
    answered += 1
    await waitForProgress(slug, funnelSignature())
    forcingPaused = false
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

  if (!nodes.some((el) => slugOf(el) === slug)) {
    releaseForcedDisplay()
    return { matched: false, changed: false }
  }

  let changed = false

  for (const el of nodes) {
    const on = slugOf(el) === slug

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

  return { matched: true, changed }
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
    prefilledSlug = null
  }
  if (onChange) previewStepOnChange = onChange

  const { changed } = applyHeatmapPreviewStep(slug)

  if (stepNodes().length > 0 && prefilledSlug !== slug) {
    void prefillForStep(slug).then((filled) => {
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
  prefilledSlug = null
  forcingPaused = false
  if (previewStepTimer != null) {
    window.clearInterval(previewStepTimer)
    previewStepTimer = null
  }

  releaseForcedDisplay()
}
