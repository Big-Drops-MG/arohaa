interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

export function generateFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return ""
  }

  const nav = navigator as NavigatorWithMemory

  let timezone = ""
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
  } catch {
    timezone = ""
  }

  const signals: Array<string | number | undefined> = [
    nav.language,
    nav.platform,
    nav.hardwareConcurrency,
    nav.deviceMemory,
    window.screen?.width,
    window.screen?.height,
    window.screen?.colorDepth,
    timezone,
  ]

  const raw = signals
    .map((s) => (s === undefined || s === null ? "" : String(s)))
    .join("|")

  let hash = 2166136261
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  let hash2 = 0x811c9dc5
  for (let i = raw.length - 1; i >= 0; i--) {
    hash2 ^= raw.charCodeAt(i)
    hash2 = Math.imul(hash2, 16777619)
  }

  const a = (hash >>> 0).toString(16).padStart(8, "0")
  const b = (hash2 >>> 0).toString(16).padStart(8, "0")
  return `${a}${b}`.slice(0, 12)
}
