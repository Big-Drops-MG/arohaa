const PREVIEW_STEP_INTERVAL_MS = 350

let previewStepSlug: string | null = null
let previewStepTimer: number | null = null

function normalizeStepSlug(raw: string): string {
  return raw.replace(/^#\/?/, "").trim().toLowerCase()
}

function stepNodes(): HTMLElement[] {
  const preferred = document.querySelectorAll<HTMLElement>(
    ".step.carousel-item[data-step], .carousel-item[data-step]"
  )
  if (preferred.length > 0) return Array.from(preferred)
  return Array.from(document.querySelectorAll<HTMLElement>("[data-step]")).filter(
    (el) => {
      const cls = typeof el.className === "string" ? el.className : ""
      return /\bstep\b|\bcarousel-item\b/i.test(cls) || el.hasAttribute("data-step")
    }
  )
}

export function applyHeatmapPreviewStep(slugRaw: string): boolean {
  const slug = normalizeStepSlug(slugRaw)
  if (!slug || slug === "start") {
    clearHeatmapPreviewStep()
    return false
  }

  const nodes = stepNodes()
  if (nodes.length === 0) {
    try {
      const nextHash = `#/${slug}`
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash
      }
    } catch {
      /* ignore */
    }
    return false
  }

  let matched = false
  for (const el of nodes) {
    const step = (el.getAttribute("data-step") || "").trim().toLowerCase()
    const on = step === slug
    if (on) matched = true
    el.style.setProperty("display", on ? "block" : "none", "important")
    el.classList.toggle("active", on)
  }

  if (matched) {
    try {
      const nextHash = `#/${slug}`
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash)
      }
    } catch {
      /* ignore */
    }
  }

  return matched
}

export function startHeatmapPreviewStep(slugRaw: string): boolean {
  const slug = normalizeStepSlug(slugRaw)
  if (!slug || slug === "start") {
    clearHeatmapPreviewStep()
    return false
  }

  previewStepSlug = slug
  const matched = applyHeatmapPreviewStep(slug)

  if (previewStepTimer == null) {
    previewStepTimer = window.setInterval(() => {
      if (!previewStepSlug) return
      applyHeatmapPreviewStep(previewStepSlug)
    }, PREVIEW_STEP_INTERVAL_MS)
  }

  return matched
}

export function clearHeatmapPreviewStep(): void {
  previewStepSlug = null
  if (previewStepTimer != null) {
    window.clearInterval(previewStepTimer)
    previewStepTimer = null
  }

  const nodes = stepNodes()
  for (const el of nodes) {
    el.style.removeProperty("display")
  }
}
