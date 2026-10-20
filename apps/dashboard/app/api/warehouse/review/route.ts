import { NextResponse } from "next/server"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireWarehouseReviewer } from "@/lib/server/warehouse-auth"

async function proxy(method: "GET" | "PATCH", request: Request) {
  const gate = await requireWarehouseReviewer()
  if (!gate.ok) return gate.response

  const apiBase = resolveIngestApiBase()
  if (!apiBase) {
    return NextResponse.json(
      { error: "INGEST_BASE_URL is not configured" },
      { status: 503 }
    )
  }
  const secret = resolveInternalApiSecret()
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(secret ? { "x-arohaa-internal": secret } : {}),
  }
  const target = new URL(`${apiBase}/v1/warehouse/review`)
  if (method === "GET") {
    const url = new URL(request.url)
    url.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value)
    })
  }

  let bodyText: string | undefined
  if (method === "PATCH") {
    const incoming = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const actorLabel =
      gate.actor.email?.trim() || gate.actor.id || "warehouse-reviewer"
    bodyText = JSON.stringify({
      ...incoming,
      decisionBy: actorLabel,
      callOutcomeBy: actorLabel,
    })
  }

  try {
    const res = await fetch(target, {
      method,
      cache: "no-store",
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(30_000),
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review request failed" },
      { status: 503 }
    )
  }
}

export async function GET(request: Request) {
  return proxy("GET", request)
}

export async function PATCH(request: Request) {
  return proxy("PATCH", request)
}
