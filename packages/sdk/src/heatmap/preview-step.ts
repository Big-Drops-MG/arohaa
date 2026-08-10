const PREVIEW_STEP_INTERVAL_MS = 400

let previewStepSlug: string | null = null
let previewStepTimer: number | null = null
let previewStepOnChange: (() => void) | null = null

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

export function applyHeatmapPreviewStep(slugRaw: string): {
  matched: boolean
  changed: boolean
} {
  const slug = normalizeStepSlug(slugRaw)
  if (!slug || slug === "start") return { matched: false, changed: false }

  const nodes = stepNodes()
  if (nodes.length === 0) return { matched: false, changed: false }

  let matched = false
  let changed = false

  for (const el of nodes) {
    const step = (el.getAttribute("data-step") || "").trim().toLowerCase()
    const on = step === slug
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

  previewStepSlug = slug
  if (onChange) previewStepOnChange = onChange

  const { changed } = applyHeatmapPreviewStep(slug)

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
  if (previewStepTimer != null) {
    window.clearInterval(previewStepTimer)
    previewStepTimer = null
  }

  for (const el of stepNodes()) {
    el.style.removeProperty("display")
  }
}
