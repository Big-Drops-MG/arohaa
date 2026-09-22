import { getCookie, setCookie } from "../services/cookie.service"

export interface AttributionData {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  utm_id: string
  utm_s1: string
  referrer: string
}

const EMPTY: AttributionData = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  utm_id: "",
  utm_s1: "",
  referrer: "",
}

const COOKIE_FALLBACK: Record<string, string> = {
  utm_source: "subid1",
  utm_id: "subid2",
  utm_s1: "subid3",
  utm_medium: "utm_medium",
  utm_term: "utm_term",
  utm_campaign: "utm_campaign",
}

const SESSION_UTM_KEY = "aro_utm_attr"
const UTM_COOKIE_DAYS = 30

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_s1",
] as const

type UtmKey = (typeof UTM_KEYS)[number]

const UTM_MAX: Record<UtmKey, number> = {
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 255,
  utm_term: 500,
  utm_content: 255,
  utm_id: 100,
  utm_s1: 100,
}

function readParam(params: URLSearchParams, key: string, max: number): string {
  let raw = params.get(key) ?? ""
  if (!raw) {
    const cookieName = COOKIE_FALLBACK[key]
    if (cookieName) {
      const fromCookie = getCookie(cookieName)
      if (fromCookie) {
        try {
          raw = decodeURIComponent(fromCookie)
        } catch {
          raw = fromCookie
        }
      }
    }
  }
  if (!raw) return ""
  return raw.length > max ? raw.slice(0, max) : raw
}

function readParamWithAliases(
  params: URLSearchParams,
  keys: string[],
  max: number,
): string {
  for (const key of keys) {
    const value = readParam(params, key, max)
    if (value) return value
  }
  return ""
}

function readSessionAttribution(): Partial<Record<UtmKey, string>> | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_UTM_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }
    const out: Partial<Record<UtmKey, string>> = {}
    for (const key of UTM_KEYS) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === "string" && value.trim()) {
        out[key] = value.slice(0, UTM_MAX[key])
      }
    }
    return out
  } catch {
    return null
  }
}

function persistSessionAttribution(data: AttributionData): void {
  if (typeof sessionStorage === "undefined") return
  const payload: Partial<Record<UtmKey, string>> = {}
  let hasAny = false
  for (const key of UTM_KEYS) {
    const value = data[key]?.trim()
    if (value) {
      payload[key] = value.slice(0, UTM_MAX[key])
      hasAny = true
    }
  }
  try {
    if (!hasAny) {
      sessionStorage.removeItem(SESSION_UTM_KEY)
      return
    }
    sessionStorage.setItem(SESSION_UTM_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }

  if (payload.utm_source) {
    setCookie("subid1", encodeURIComponent(payload.utm_source), UTM_COOKIE_DAYS)
  }
  if (payload.utm_id) {
    setCookie("subid2", encodeURIComponent(payload.utm_id), UTM_COOKIE_DAYS)
  }
  if (payload.utm_s1) {
    setCookie("subid3", encodeURIComponent(payload.utm_s1), UTM_COOKIE_DAYS)
  }
}

function mergeUtm(
  fromUrl: string,
  fromSession: string | undefined,
  max: number,
): string {
  const primary = fromUrl.trim()
  if (primary) return primary.length > max ? primary.slice(0, max) : primary
  const fallback = (fromSession ?? "").trim()
  if (!fallback) return ""
  return fallback.length > max ? fallback.slice(0, max) : fallback
}

export function getAttributionData(): AttributionData {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return EMPTY
  }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(window.location.search)
  } catch {
    return EMPTY
  }

  const session = readSessionAttribution()
  const referrer = (document.referrer || "").trim()

  const fromUrl: AttributionData = {
    utm_source: readParamWithAliases(params, ["utm_source", "sid"], 100),
    utm_medium: readParam(params, "utm_medium", 100),
    utm_campaign: readParam(params, "utm_campaign", 255),
    utm_term: readParam(params, "utm_term", 500),
    utm_content: readParam(params, "utm_content", 255),
    utm_id: readParamWithAliases(params, ["utm_id", "tid"], 100),
    utm_s1: readParamWithAliases(params, ["utm_s1", "sub1"], 100),
    referrer: referrer.length > 0 ? referrer.slice(0, 2048) : "direct",
  }

  const hasUrlUtm = UTM_KEYS.some((key) => Boolean(fromUrl[key]))
  if (hasUrlUtm) {
    persistSessionAttribution(fromUrl)
    return fromUrl
  }

  return {
    utm_source: mergeUtm(fromUrl.utm_source, session?.utm_source, 100),
    utm_medium: mergeUtm(fromUrl.utm_medium, session?.utm_medium, 100),
    utm_campaign: mergeUtm(fromUrl.utm_campaign, session?.utm_campaign, 255),
    utm_term: mergeUtm(fromUrl.utm_term, session?.utm_term, 500),
    utm_content: mergeUtm(fromUrl.utm_content, session?.utm_content, 255),
    utm_id: mergeUtm(fromUrl.utm_id, session?.utm_id, 100),
    utm_s1: mergeUtm(fromUrl.utm_s1, session?.utm_s1, 100),
    referrer: fromUrl.referrer,
  }
}

export function safePageUrl(href?: string): string {
  const raw =
    href ??
    (typeof window !== "undefined" ? window.location.href : "")
  if (!raw) return ""
  try {
    const url = new URL(raw)
    return `${url.origin}${url.pathname}${url.hash}`
  } catch {
    const noQuery = raw.split("?")[0] ?? ""
    return noQuery.slice(0, 2048)
  }
}
