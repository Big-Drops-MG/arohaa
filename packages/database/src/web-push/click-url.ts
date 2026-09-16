import type {
  WebPushCampaignClick,
  WebPushSubscriptionContext,
} from "../schema/web-push.js"

export type ResolveClickUrlInput = {
  click: WebPushCampaignClick
  campaignId: string
  landingPageId: string
  landingPagePublicId?: string | null
  subscriptionId: string
  origin?: string | null
  lastSeenUrl?: string | null
  context?: WebPushSubscriptionContext | null
}

function appendQueryParams(
  url: string,
  params: Record<string, string | null | undefined>
): string {
  try {
    const parsed = new URL(url)
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "") continue
      parsed.searchParams.set(key, value)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function substituteTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key]
    return value == null ? "" : encodeURIComponent(value)
  })
}

export function resolveWebPushClickUrl(input: ResolveClickUrlInput): string {
  const ctx = input.context ?? {}
  const query =
    ctx.query && typeof ctx.query === "object"
      ? (ctx.query as Record<string, string>)
      : {}
  const utm =
    ctx.utm && typeof ctx.utm === "object"
      ? (ctx.utm as Record<string, string>)
      : {}

  let lpHost = ""
  if (input.origin) {
    try {
      lpHost = new URL(input.origin).host
    } catch {
      lpHost = input.origin.replace(/^https?:\/\//, "")
    }
  } else if (input.lastSeenUrl) {
    try {
      lpHost = new URL(input.lastSeenUrl).host
    } catch {
      lpHost = ""
    }
  }

  const vars: Record<string, string | null | undefined> = {
    lp_host: lpHost,
    landing_page_id: input.landingPageId,
    wid: input.landingPagePublicId ?? input.landingPageId,
    campaign_id: input.campaignId,
    subscription_id: input.subscriptionId,
    last_url: input.lastSeenUrl ?? "",
    session_id:
      typeof ctx.sessionId === "string" ? ctx.sessionId : undefined,
    zip: typeof ctx.zip === "string" ? ctx.zip : query.zip,
    step:
      ctx.step != null
        ? String(ctx.step)
        : query.step != null
          ? String(query.step)
          : undefined,
    ...utm,
    ...Object.fromEntries(
      Object.entries(utm).map(([k, v]) => [`utm_${k.replace(/^utm_/, "")}`, v])
    ),
  }

  const appendUtms = input.click.appendUtms ?? {}
  let resolved: string

  if (input.click.mode === "fixed") {
    resolved = (input.click.fixedUrl ?? "").trim()
  } else if (input.click.mode === "last_url") {
    resolved = (input.lastSeenUrl ?? input.click.fixedUrl ?? "").trim()
    if (!resolved && input.origin) {
      resolved = input.origin
    }
  } else {
    const template = (input.click.urlTemplate ?? "").trim()
    resolved = substituteTemplate(template, vars)
  }

  if (!resolved && input.origin) {
    resolved = input.origin
  }

  if (!/^https?:\/\//i.test(resolved) && input.origin) {
    try {
      resolved = new URL(resolved || "/", input.origin).toString()
    } catch {
      resolved = input.origin
    }
  }

  return appendQueryParams(resolved, appendUtms)
}
