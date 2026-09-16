import { webPushSignatureHeader } from "./web-push-hmac"
import type {
  WebPushContext,
  WebPushSubscriptionJson,
} from "../model/web-push"

export type ArohaaWebPushForwardConfig = {
  /** e.g. https://api.arohaa.net */
  apiBase: string
  /** Plaintext secret from Notification Center (server-only) */
  webhookSecret?: string | null
  fetchImpl?: typeof fetch
}

function joinApi(apiBase: string, path: string): string {
  return `${apiBase.replace(/\/$/, "")}${path}`
}

async function postSignedJson(
  config: ArohaaWebPushForwardConfig,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const fetchFn = config.fetchImpl ?? fetch
  const rawBody = JSON.stringify(body)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const secret = config.webhookSecret?.trim()
  if (secret) {
    headers["x-arohaa-web-push-signature"] = await webPushSignatureHeader(
      secret,
      rawBody,
    )
  }

  const res = await fetchFn(joinApi(config.apiBase, path), {
    method: "POST",
    headers,
    body: rawBody,
  })

  let json: Record<string, unknown> = {}
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    json = {}
  }

  return { ok: res.ok, status: res.status, json }
}

export async function forwardWebPushSubscribe(input: {
  config: ArohaaWebPushForwardConfig
  action: "subscribe" | "unsubscribe"
  subscription: WebPushSubscriptionJson
  context?: WebPushContext | null
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  return postSignedJson(input.config, "/v1/web-push/subscriptions", {
    action: input.action,
    subscription: input.subscription,
    context: input.context ?? undefined,
  })
}

export async function forwardWebPushEvent(input: {
  config: ArohaaWebPushForwardConfig
  event: string
  subscriptionEndpoint?: string | null
  wid?: string | null
  landingPageId?: string | null
  occurredAt?: string | null
  context?: WebPushContext | null
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  return postSignedJson(input.config, "/v1/web-push/events", {
    event: input.event,
    subscription_endpoint: input.subscriptionEndpoint ?? undefined,
    wid: input.wid ?? input.context?.wid,
    landing_page_id: input.landingPageId ?? input.context?.landing_page_id,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    context: input.context ?? undefined,
  })
}

/**
 * Minimal Next.js App Router handlers that forward to Arohaa.
 * Copy into `app/api/push/subscribe/route.ts` (and siblings) or adapt.
 */
export function buildNextPushRouteStubs(env: {
  apiBaseEnv?: string
  secretEnv?: string
}): string {
  const apiBaseEnv = env.apiBaseEnv ?? "WEB_PUSH_AROHAA_API_BASE"
  const secretEnv = env.secretEnv ?? "WEB_PUSH_WEBHOOK_SECRET"
  return `import { NextRequest, NextResponse } from "next/server"
import {
  forwardWebPushEvent,
  forwardWebPushSubscribe,
} from "@workspace/lp-core/controller"

function arohaaConfig() {
  const apiBase = process.env.${apiBaseEnv}?.trim()
  if (!apiBase) throw new Error("${apiBaseEnv} is required")
  return {
    apiBase,
    webhookSecret: process.env.${secretEnv}?.trim() || null,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const path = req.nextUrl.pathname
  const config = arohaaConfig()

  if (path.endsWith("/events")) {
    const result = await forwardWebPushEvent({
      config,
      event: String(body.event ?? ""),
      subscriptionEndpoint: body.subscription_endpoint,
      wid: body.wid ?? body.context?.wid,
      landingPageId: body.landing_page_id ?? body.context?.landing_page_id,
      occurredAt: body.occurred_at,
      context: body.context,
    })
    return NextResponse.json(result.json, { status: result.status })
  }

  const action =
    path.endsWith("/unsubscribe") || body.action === "unsubscribe"
      ? "unsubscribe"
      : "subscribe"
  const result = await forwardWebPushSubscribe({
    config,
    action,
    subscription: body.subscription,
    context: body.context,
  })
  return NextResponse.json(result.json, { status: result.status })
}
`
}
