import {
  WEB_PUSH_ENDPOINT_STORAGE_KEY,
  buildWebPushContext,
  pushSubscriptionToJson,
  resolveProxyPaths,
  urlBase64ToUint8Array,
  type WebPushContext,
  type WebPushEnvConfig,
  type WebPushSubscriptionJson,
} from "../model/web-push"

function rememberEndpoint(endpoint: string | null): void {
  try {
    if (!endpoint) {
      localStorage.removeItem(WEB_PUSH_ENDPOINT_STORAGE_KEY)
      return
    }
    localStorage.setItem(WEB_PUSH_ENDPOINT_STORAGE_KEY, endpoint)
  } catch {
    /* ignore */
  }
}

export function getStoredWebPushEndpoint(): string | null {
  try {
    return localStorage.getItem(WEB_PUSH_ENDPOINT_STORAGE_KEY)
  } catch {
    return null
  }
}

function resolveUrls(config: WebPushEnvConfig): {
  subscribeUrl: string
  unsubscribeUrl: string
  eventsUrl: string
} {
  if (config.proxyBase?.trim()) {
    return resolveProxyPaths(config.proxyBase.trim())
  }
  const subscribe =
    config.subscribeUrl?.trim() ||
    (typeof window !== "undefined" ? "/api/push/subscribe" : "")
  const events =
    config.eventsUrl?.trim() ||
    (typeof window !== "undefined" ? "/api/push/events" : "")
  return {
    subscribeUrl: subscribe,
    unsubscribeUrl: subscribe,
    eventsUrl: events,
  }
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  })
  let json: Record<string, unknown> = {}
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    json = {}
  }
  return { ok: res.ok, status: res.status, json }
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export async function ensureWebPushServiceWorker(
  swUrl = "/sw.js",
): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(swUrl)
  await navigator.serviceWorker.ready
  return reg
}

export async function subscribeWebPush(input: {
  config: WebPushEnvConfig
  context?: Partial<WebPushContext>
  requestPermission?: boolean
}): Promise<
  | { ok: true; subscription: WebPushSubscriptionJson }
  | { ok: false; error: string; status?: number }
> {
  if (!isWebPushSupported()) {
    return { ok: false, error: "Web Push is not supported in this browser" }
  }

  const vapid = input.config.vapidPublicKey?.trim()
  if (!vapid) {
    return { ok: false, error: "vapidPublicKey is required" }
  }

  if (input.requestPermission !== false) {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return { ok: false, error: `Notification permission: ${permission}` }
    }
  }

  const reg = await ensureWebPushServiceWorker(
    input.config.serviceWorkerUrl ?? "/sw.js",
  )
  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapid,
      ) as BufferSource,
    }))

  const json = pushSubscriptionToJson(subscription)
  rememberEndpoint(json.endpoint)

  const urls = resolveUrls(input.config)
  const context = buildWebPushContext({
    wid: input.config.wid,
    session_id: input.config.sessionId,
    ...input.context,
  })

  const result = await postJson(urls.subscribeUrl, {
    action: "subscribe",
    subscription: json,
    context,
  })

  if (!result.ok) {
    return {
      ok: false,
      error: String(result.json.error ?? "Subscribe forward failed"),
      status: result.status,
    }
  }

  return { ok: true, subscription: json }
}

export async function unsubscribeWebPush(input: {
  config: WebPushEnvConfig
  context?: Partial<WebPushContext>
}): Promise<{ ok: boolean; error?: string }> {
  if (!isWebPushSupported()) {
    return { ok: false, error: "Web Push is not supported" }
  }

  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    rememberEndpoint(null)
    return { ok: true }
  }

  const json = pushSubscriptionToJson(subscription)
  const urls = resolveUrls(input.config)
  const context = buildWebPushContext({
    wid: input.config.wid,
    session_id: input.config.sessionId,
    ...input.context,
  })

  await postJson(urls.unsubscribeUrl, {
    action: "unsubscribe",
    subscription: json,
    context,
  })

  await subscription.unsubscribe()
  rememberEndpoint(null)
  return { ok: true }
}

export async function reportWebPushEvent(input: {
  config: WebPushEnvConfig
  event: string
  context?: Partial<WebPushContext>
  subscriptionEndpoint?: string | null
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const urls = resolveUrls(input.config)
  if (!urls.eventsUrl) {
    return { ok: false, error: "eventsUrl / proxyBase required" }
  }

  const endpoint =
    input.subscriptionEndpoint ?? getStoredWebPushEndpoint() ?? undefined
  const context = buildWebPushContext({
    wid: input.config.wid,
    session_id: input.config.sessionId,
    ...input.context,
  })

  const result = await postJson(urls.eventsUrl, {
    event: input.event,
    subscription_endpoint: endpoint,
    wid: context.wid,
    occurred_at: new Date().toISOString(),
    context,
  })

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: String(result.json.error ?? "Event forward failed"),
    }
  }
  return { ok: true, status: result.status }
}

/** Wire page_hidden / page_visible for abandon + cancel campaigns. */
export function attachWebPushVisibilityEvents(
  config: WebPushEnvConfig,
  options?: { context?: Partial<WebPushContext> },
): () => void {
  if (typeof document === "undefined") return () => undefined

  const onChange = () => {
    const event =
      document.visibilityState === "hidden" ? "page_hidden" : "page_visible"
    void reportWebPushEvent({
      config,
      event,
      context: options?.context,
    })
  }

  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}
