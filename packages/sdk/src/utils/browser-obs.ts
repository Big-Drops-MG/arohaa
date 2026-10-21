export const BROWSER_OBS_VERSION = 1

export type ObservationSupport = "available" | "unavailable" | "unsupported"

export type BrowserObservation = {
  v: number
  platform: string
  platformSupport: ObservationSupport
  languages: string[]
  languageSupport: ObservationSupport
  timezone: string
  timezoneSupport: ObservationSupport
  touchPoints: number
  touchSupport: ObservationSupport
  screen: { w: number; h: number; dpr: number }
  screenSupport: ObservationSupport
  viewport: { w: number; h: number }
  viewportSupport: ObservationSupport
  webdriver: boolean | null
  webdriverSupport: ObservationSupport
  automationHints: string[]
  automationSupport: ObservationSupport
  clientHints: Record<string, string>
  clientHintsSupport: ObservationSupport
  apiConsistency: Array<{ check: string; ok: boolean; support: ObservationSupport }>
}

function support(ok: boolean, unsupported = false): ObservationSupport {
  if (unsupported) return "unsupported"
  return ok ? "available" : "unavailable"
}

export function collectBrowserObservations(): BrowserObservation {
  const nav =
    typeof navigator !== "undefined" ? navigator : (null as Navigator | null)
  const win =
    typeof window !== "undefined" ? window : (null as Window | null)
  const globalScreen =
    typeof globalThis !== "undefined" && "screen" in globalThis
      ? (globalThis as typeof globalThis & { screen: Screen }).screen
      : null

  const platform = nav?.platform?.trim() || ""
  const languages = Array.isArray(nav?.languages)
    ? nav!.languages.map(String).slice(0, 8)
    : nav?.language
      ? [String(nav.language)]
      : []

  let timezone = ""
  let timezoneSupport: ObservationSupport = "unavailable"
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    timezoneSupport = support(Boolean(timezone))
  } catch {
    timezoneSupport = "unsupported"
  }

  const touchPoints =
    typeof nav?.maxTouchPoints === "number" ? nav.maxTouchPoints : -1

  const screenMetrics =
    globalScreen != null
      ? {
          w: Number(globalScreen.width) || 0,
          h: Number(globalScreen.height) || 0,
          dpr: win ? Number(win.devicePixelRatio) || 1 : 1,
        }
      : { w: 0, h: 0, dpr: 1 }

  const viewport =
    win != null
      ? {
          w: Number(win.innerWidth) || 0,
          h: Number(win.innerHeight) || 0,
        }
      : { w: 0, h: 0 }

  let webdriver: boolean | null = null
  let webdriverSupport: ObservationSupport = "unavailable"
  try {
    if (nav && "webdriver" in nav) {
      webdriver = Boolean(nav.webdriver)
      webdriverSupport = "available"
    } else {
      webdriverSupport = "unsupported"
    }
  } catch {
    webdriverSupport = "unavailable"
  }

  const automationHints: string[] = []
  if (webdriver === true) automationHints.push("webdriver")
  try {
    const w = win as Window & {
      chrome?: unknown
      callPhantom?: unknown
      _phantom?: unknown
      __nightmare?: unknown
    }
    if (w?.callPhantom || w?._phantom) automationHints.push("phantom")
    if (w?.__nightmare) automationHints.push("nightmare")
    if (nav && (nav as Navigator & { selenium?: unknown }).selenium) {
      automationHints.push("selenium")
    }
  } catch {
    /* ignore */
  }

  const clientHints: Record<string, string> = {}
  let clientHintsSupport: ObservationSupport = "unsupported"
  try {
    const uaData = (
      nav as Navigator & {
        userAgentData?: {
          platform?: string
          mobile?: boolean
          brands?: Array<{ brand: string; version: string }>
        }
      }
    )?.userAgentData
    if (uaData) {
      clientHintsSupport = "available"
      if (uaData.platform) clientHints.platform = String(uaData.platform)
      if (typeof uaData.mobile === "boolean") {
        clientHints.mobile = uaData.mobile ? "1" : "0"
      }
      if (Array.isArray(uaData.brands)) {
        clientHints.brands = uaData.brands
          .slice(0, 6)
          .map((b) => `${b.brand}:${b.version}`)
          .join("|")
      }
    }
  } catch {
    clientHintsSupport = "unavailable"
  }

  const apiConsistency: BrowserObservation["apiConsistency"] = []
  try {
    const hasMatchMedia = typeof win?.matchMedia === "function"
    apiConsistency.push({
      check: "matchMedia",
      ok: hasMatchMedia,
      support: support(hasMatchMedia, !win),
    })
  } catch {
    apiConsistency.push({
      check: "matchMedia",
      ok: false,
      support: "unavailable",
    })
  }
  try {
    const hasLocalStorage = typeof localStorage !== "undefined"
    apiConsistency.push({
      check: "localStorage",
      ok: hasLocalStorage,
      support: support(hasLocalStorage),
    })
  } catch {
    apiConsistency.push({
      check: "localStorage",
      ok: false,
      support: "unavailable",
    })
  }

  return {
    v: BROWSER_OBS_VERSION,
    platform,
    platformSupport: support(Boolean(platform), !nav),
    languages,
    languageSupport: support(languages.length > 0, !nav),
    timezone,
    timezoneSupport,
    touchPoints,
    touchSupport: support(touchPoints >= 0, !nav),
    screen: screenMetrics,
    screenSupport: support(
      screenMetrics.w > 0 || screenMetrics.h > 0,
      !globalScreen,
    ),
    viewport,
    viewportSupport: support(viewport.w > 0 || viewport.h > 0, !win),
    webdriver,
    webdriverSupport,
    automationHints,
    automationSupport: support(true, !nav),
    clientHints,
    clientHintsSupport,
    apiConsistency,
  }
}
