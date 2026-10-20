import { NextResponse } from "next/server"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireWarehouseReviewer } from "@/lib/server/warehouse-auth"

export async function GET() {
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
  const headers: Record<string, string> = secret
    ? { "x-arohaa-internal": secret }
    : {}
  try {
    const res = await fetch(`${apiBase}/v1/warehouse/partner-scorecards`, {
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
        error: err instanceof Error ? err.message : "Partner scorecards failed",
      },
      { status: 503 }
    )
  }
}
