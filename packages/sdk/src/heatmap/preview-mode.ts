const PREVIEW_FLAG = "_arohaa_preview"

let cachedPreview: boolean | null = null

function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

export function isHeatmapPreview(): boolean {
  if (cachedPreview !== null) return cachedPreview
  if (typeof window === "undefined") return false
  if (!isFramed()) {
    cachedPreview = false
    return false
  }

  try {
    const flag = new URLSearchParams(window.location.search).get(PREVIEW_FLAG)
    cachedPreview = flag === "1"
  } catch {
    cachedPreview = false
  }

  return cachedPreview
}

export function clearPreviewSiteState(): void {
  try {
    window.localStorage.clear()
  } catch {
    /* storage can be unavailable in sandboxed frames */
  }
  try {
    window.sessionStorage.clear()
  } catch {
    /* storage can be unavailable in sandboxed frames */
  }
}
