import { NextResponse } from "next/server"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireWarehouseReviewer } from "@/lib/server/warehouse-auth"

export async function GET(request: Request) {
  const gate = await requireWarehouseReviewer()
  if (!gate.ok) return gate.response

  const apiBase = resolveIngestApiBase()
  if (!apiBase) {
    return NextResponse.json(
      { error: "INGEST_BASE_URL is not configured" },
      { status: 503 }
    )
  }
  const url = new URL(request.url)
  const target = new URL(`${apiBase}/v1/warehouse/session-evidence`)
  url.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value)
  })
  const secret = resolveInternalApiSecret()
  const headers: Record<string, string> = secret
    ? { "x-arohaa-internal": secret }
    : {}
  try {
    const res = await fetch(target, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(30_000),
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Session evidence failed",
      },
      { status: 503 }
    )
  }
}
