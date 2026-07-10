import { getAttributionData } from "../utils/url"
import {
  isAccessDeniedPath,
  normalizeDeniedPath,
} from "../utils/utm-block"
import type { SDKConfig } from "../types"

type BlockedUtmResponse = {
  utm_source?: string[]
  utm_s1?: string[]
}

type StoredUtmParamKey = "utm_source" | "utm_s1"

function sanitizeUtmParamValue(key: StoredUtmParamKey, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const delimiterIndex = trimmed.search(/[&?#]/)
  const candidate = (
    delimiterIndex === -1 ? trimmed : trimmed.slice(0, delimiterIndex)
  ).trim()
  if (!candidate) return ""

  if (/\butm_[a-z0-9_]+=/i.test(candidate)) return ""
  if (key === "utm_source" && candidate.includes("=")) return ""

  return candidate
}

function isCurrentUtmBlocked(
  blocked: BlockedUtmResponse,
  utmSource: string,
  utmS1: string,
): boolean {
  const source = sanitizeUtmParamValue("utm_source", utmSource)
  if (source && blocked.utm_source?.includes(source)) return true

  const s1 = sanitizeUtmParamValue("utm_s1", utmS1)
  if (s1 && blocked.utm_s1?.includes(s1)) return true

  return false
}

function hidePageWhileChecking(): () => void {
  const html = document.documentElement
  const previousVisibility = html.style.visibility
  html.style.visibility = "hidden"
  return () => {
    html.style.visibility = previousVisibility
  }
}

function renderBlockedPage(): void {
  const html = document.documentElement
  html.style.visibility = "visible"

  if (!document.body) return

  document.body.innerHTML = ""
  document.body.style.margin = "0"

  const panel = document.createElement("div")
  panel.setAttribute("role", "alert")
  panel.style.cssText =
    "display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#171717;"
  panel.textContent = "This link is not available."

  document.body.appendChild(panel)
}

async function fetchBlockedUtms(
  apiBase: string,
  wid: string,
): Promise<BlockedUtmResponse | null> {
  const base = apiBase.replace(/\/$/, "")
  const url = `${base}/v1/utm-blocked?wid=${encodeURIComponent(wid)}`

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    })
    if (!response.ok) return null
    return (await response.json()) as BlockedUtmResponse
  } catch {
    return null
  }
}

export async function enforceUtmBlockGate(config: SDKConfig): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false
  }

  const attribution = getAttributionData()
  const hasUtm = !!(attribution.utm_source || attribution.utm_s1)
  if (!hasUtm) return false

  const restoreVisibility = hidePageWhileChecking()

  try {
    const blocked = await fetchBlockedUtms(config.apiBase, config.wid)
    if (!blocked) {
      restoreVisibility()
      return false
    }

    const hasBlockedRules =
      (blocked.utm_source?.length ?? 0) > 0 ||
      (blocked.utm_s1?.length ?? 0) > 0
    if (!hasBlockedRules) {
      restoreVisibility()
      return false
    }

    if (
      !isCurrentUtmBlocked(
        blocked,
        attribution.utm_source,
        attribution.utm_s1,
      )
    ) {
      restoreVisibility()
      return false
    }

    const redirect =
      config.utmBlockRedirect?.trim() ||
      normalizeDeniedPath(config.utmDeniedPath)
    if (
      redirect &&
      !isAccessDeniedPath(window.location.pathname, redirect)
    ) {
      try {
        window.location.replace(redirect)
      } catch {
        window.location.href = redirect
      }
      return true
    }

    renderBlockedPage()
    return true
  } catch {
    restoreVisibility()
    return false
  }
}
