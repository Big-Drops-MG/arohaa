export interface AttributionData {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  referrer: string
}

const EMPTY: AttributionData = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  referrer: "",
}

function readParam(params: URLSearchParams, key: string, max: number): string {
  const raw = params.get(key)
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
    referrer: referrer.length > 0 ? referrer.slice(0, 2048) : "direct",
  }
}
