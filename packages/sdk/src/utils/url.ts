import { getCookie } from "../services/cookie.service"

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

function readParam(params: URLSearchParams, key: string, max: number): string {
  let raw = params.get(key) ?? ""
  if (!raw) {
    const cookieName = COOKIE_FALLBACK[key]
    if (cookieName) {
      const fromCookie = getCookie(cookieName)
      if (fromCookie) raw = decodeURIComponent(fromCookie)
    }
  }
  if (!raw) return ""
  return raw.length > max ? raw.slice(0, max) : raw
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

  const referrer = (document.referrer || "").trim()

  return {
    utm_source: readParam(params, "utm_source", 100),
    utm_medium: readParam(params, "utm_medium", 100),
    utm_campaign: readParam(params, "utm_campaign", 255),
    utm_term: readParam(params, "utm_term", 500),
    utm_content: readParam(params, "utm_content", 255),
    utm_id: readParam(params, "utm_id", 100),
    utm_s1: readParam(params, "utm_s1", 100),
    referrer: referrer.length > 0 ? referrer.slice(0, 2048) : "direct",
  }
}
