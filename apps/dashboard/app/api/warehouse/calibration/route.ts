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

  try {
    const res = await fetch(`${apiBase}/v1/warehouse/calibration`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-arohaa-internal": secret } : {}),
      },
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
        error:
          err instanceof Error ? err.message : "Calibration request failed",
      },
      { status: 503 }
    )
  }
}
