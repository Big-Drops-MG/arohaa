const ENDPOINT_KEY = "arohaa_web_push_endpoint"

export function getStoredEndpoint(): string | null {
  try {
    return localStorage.getItem(ENDPOINT_KEY)
  } catch {
    return null
  }
}

function buildContext(wid?: string, lpId?: string): Record<string, unknown> {
  const url = new URL(window.location.href)
  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timezone = undefined
  }
  return {
    wid,
    landing_page_id: lpId,
    origin: window.location.origin,
    page_url: window.location.href,
    page_path: url.pathname,
    timezone,
    user_agent: navigator.userAgent,
  }
}

export async function postWebPushProxyEvent(input: {
  proxyBase: string
  event: string
  subscriptionEndpoint?: string | null
  wid?: string
  lpId?: string
}): Promise<void> {
  const base = input.proxyBase.replace(/\/$/, "")
  const body = JSON.stringify({
    event: input.event,
    subscription_endpoint: input.subscriptionEndpoint ?? undefined,
    wid: input.wid,
    landing_page_id: input.lpId,
    occurred_at: new Date().toISOString(),
    context: buildContext(input.wid, input.lpId),
  })

  const url = `${base}/events`
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" })
      if (navigator.sendBeacon(url, blob)) return
    }
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    })
  } catch {
    /* best-effort */
  }
}
