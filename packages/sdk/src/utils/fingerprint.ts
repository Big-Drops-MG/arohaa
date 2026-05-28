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

  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }

  return Math.abs(hash).toString(16)
}
