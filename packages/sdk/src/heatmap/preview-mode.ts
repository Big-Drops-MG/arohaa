const PREVIEW_FLAG = "_arohaa_preview"
const AROHAA_STORAGE_PREFIX = "aro_"

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

function clearPrefixedStorage(storage: Storage): void {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key && key.startsWith(AROHAA_STORAGE_PREFIX)) {
      keys.push(key)
    }
  }
  for (const key of keys) {
    storage.removeItem(key)
  }
}

export function clearPreviewSiteState(): void {
  try {
    clearPrefixedStorage(window.localStorage)
  } catch {
    /* storage can be unavailable in sandboxed frames */
  }
  try {
    clearPrefixedStorage(window.sessionStorage)
  } catch {
    /* storage can be unavailable in sandboxed frames */
  }
}
