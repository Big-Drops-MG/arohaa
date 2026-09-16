export type WebPushSubscriptionJson = {
  endpoint: string
  expirationTime?: number | null
  keys: { p256dh: string; auth: string }
}

export type WebPushContext = {
  wid?: string
  landing_page_id?: string
  origin?: string
  page_url?: string
  page_path?: string
  query?: Record<string, string>
  utm?: Record<string, string>
  user_agent?: string
  timezone?: string
  session_id?: string
  zip?: string | null
  step?: number | string | null
  [key: string]: unknown
}

export type WebPushEnvConfig = {
  /** Public VAPID key from Arohaa Notification Center */
  vapidPublicKey: string
  /**
   * Same-origin LP proxy base (recommended), e.g. `/api/push`.
   * Browser posts here; LP server forwards to Arohaa with HMAC.
   */
  proxyBase?: string
  /** Direct Arohaa subscribe URL (only if webhook secret is not required yet) */
  subscribeUrl?: string
  eventsUrl?: string
  wid?: string
  sessionId?: string
  serviceWorkerUrl?: string
}

export const WEB_PUSH_ENDPOINT_STORAGE_KEY = "arohaa_web_push_endpoint"

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function buildWebPushContext(
  overrides?: Partial<WebPushContext>,
): WebPushContext {
  if (typeof window === "undefined") {
    return { ...(overrides ?? {}) }
  }

  const url = new URL(window.location.href)
  const query: Record<string, string> = {}
  const utm: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
    if ((UTM_KEYS as readonly string[]).includes(key) && value) {
      utm[key] = value
    }
  })

  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timezone = undefined
  }

  const zip = url.searchParams.get("zip")
  const stepRaw = url.searchParams.get("step")
  const stepNum = stepRaw != null ? Number(stepRaw) : NaN

  return {
    origin: window.location.origin,
    page_url: window.location.href,
    page_path: url.pathname,
    query,
    utm: Object.keys(utm).length > 0 ? utm : undefined,
    user_agent: navigator.userAgent,
    timezone,
    zip: zip || undefined,
    step: Number.isFinite(stepNum) ? stepNum : stepRaw || undefined,
    ...(overrides ?? {}),
  }
}

export function pushSubscriptionToJson(
  subscription: PushSubscription,
): WebPushSubscriptionJson {
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error("PushSubscription missing endpoint or keys")
  }
  return {
    endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh, auth },
  }
}

export function resolveProxyPaths(proxyBase: string): {
  subscribeUrl: string
  unsubscribeUrl: string
  eventsUrl: string
} {
  const base = proxyBase.replace(/\/$/, "")
  return {
    subscribeUrl: `${base}/subscribe`,
    unsubscribeUrl: `${base}/unsubscribe`,
    eventsUrl: `${base}/events`,
  }
}
