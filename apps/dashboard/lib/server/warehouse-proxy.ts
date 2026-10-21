import { NextResponse } from "next/server"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { canReviewWarehouseLeads } from "@/lib/server/actor-can"
import type { InferSelectModel, users } from "@workspace/database"

type UserRow = InferSelectModel<typeof users>

export async function assertWarehouseReviewer(
  actor: UserRow
): Promise<Response | null> {
  if (!(await canReviewWarehouseLeads(actor))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function proxyWarehouseApi(input: {
  path: string
  request: Request
  method?: "GET" | "PATCH" | "POST" | "PUT"
  bodyText?: string
}): Promise<Response> {
  const apiBase = resolveIngestApiBase()
  if (!apiBase) {
    return NextResponse.json(
      { error: "INGEST_BASE_URL is not configured" },
      { status: 503 }
    )
  }
  const secret = resolveInternalApiSecret()
  const method = input.method ?? "GET"
  const target = new URL(`${apiBase}${input.path}`)
  if (method === "GET") {
    const url = new URL(input.request.url)
    url.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value)
    })
  }
  try {
    const res = await fetch(target, {
      method,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-arohaa-internal": secret } : {}),
      },
      body: input.bodyText,
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
        error: err instanceof Error ? err.message : "Warehouse request failed",
      },
      { status: 503 }
    )
  }
}
