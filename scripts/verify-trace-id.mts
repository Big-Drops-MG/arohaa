import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"
import { randomUUID } from "node:crypto"

config({ path: path.resolve("apps/dashboard/.env.local") })

const API = "http://127.0.0.1:3001/v1/ingest"
const wid = "11111111-1111-4111-8111-111111111111"

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
})

interface SendResult {
  status: number
  headerTraceId: string | null
  bodyTraceId: string | null
}

async function sendEvent(
  marker: string,
  inboundTraceId?: string,
): Promise<SendResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  if (inboundTraceId) {
    headers["x-trace-id"] = inboundTraceId
  }

  const res = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ev: "trace_test",
      wid,
      sid: "verify-trace-sid-" + Math.random().toString(36).slice(2, 12),
      uid: "verify-trace-uid-" + Math.random().toString(36).slice(2, 12),
      ts: Date.now(),
      url: `https://united-flooring.expert/?marker=${encodeURIComponent(marker)}`,
      props: { marker },
    }),
  })

  const headerTraceId = res.headers.get("x-trace-id")
  let bodyTraceId: string | null = null
  try {
    const body = (await res.json()) as { trace_id?: string }
    bodyTraceId = body.trace_id ?? null
  } catch {
    bodyTraceId = null
  }

  return { status: res.status, headerTraceId, bodyTraceId }
}

interface ClickHouseRow {
  trace_id: string
  event_name: string
  marker: string
  at: string
}

async function queryByMarker(marker: string): Promise<ClickHouseRow[]> {
  const r = await client.query({
    query: `
      SELECT
        trace_id,
        event_name,
        JSONExtractString(properties, 'marker') AS marker,
        formatDateTime(created_at, '%H:%i:%S.%f') AS at
      FROM events
      WHERE event_name = 'trace_test'
        AND JSONExtractString(properties, 'marker') = {marker:String}
      ORDER BY created_at ASC
    `,
    query_params: { marker },
    format: "JSON",
  })
  const json = (await r.json()) as { data: ClickHouseRow[] }
  return json.data
}

function badge(passed: boolean): string {
  return passed ? "PASS" : "FAIL"
}

try {
  console.log("=== 1. Server-generated trace_id ===")
  const markerA = "auto-" + randomUUID()
  const a = await sendEvent(markerA)
  const aHeaderBodyMatch =
    a.headerTraceId !== null && a.headerTraceId === a.bodyTraceId
  console.log(`  status:        ${a.status}`)
  console.log(`  header:        ${a.headerTraceId}`)
  console.log(`  body.trace_id: ${a.bodyTraceId}`)
  console.log(
    `  header==body:  ${badge(aHeaderBodyMatch)}`,
  )

  console.log("\n=== 2. Client-supplied trace_id (must be honored) ===")
  const inbound = "client-" + randomUUID()
  const markerB = "passthrough-" + randomUUID()
  const b = await sendEvent(markerB, inbound)
  const bHeaderEcho = b.headerTraceId === inbound
  const bBodyEcho = b.bodyTraceId === inbound
  console.log(`  status:        ${b.status}`)
  console.log(`  inbound:       ${inbound}`)
  console.log(`  header:        ${b.headerTraceId}`)
  console.log(`  body.trace_id: ${b.bodyTraceId}`)
  console.log(`  header echoed: ${badge(bHeaderEcho)}`)
  console.log(`  body echoed:   ${badge(bBodyEcho)}`)

  console.log("\n=== Waiting 7s for buffer flush ===")
  await new Promise((r) => setTimeout(r, 7000))

  console.log("\n=== 3. ClickHouse: row A (server-generated) ===")
  const rowsA = await queryByMarker(markerA)
  console.log(JSON.stringify(rowsA, null, 2))
  const aRoundTrip =
    rowsA.length === 1 && rowsA[0]!.trace_id === a.headerTraceId
  console.log(`  row found + trace_id matches header: ${badge(aRoundTrip)}`)

  console.log("\n=== 4. ClickHouse: row B (client-supplied) ===")
  const rowsB = await queryByMarker(markerB)
  console.log(JSON.stringify(rowsB, null, 2))
  const bRoundTrip =
    rowsB.length === 1 && rowsB[0]!.trace_id === inbound
  console.log(`  row found + trace_id matches inbound: ${badge(bRoundTrip)}`)

  const allPassed =
    aHeaderBodyMatch && bHeaderEcho && bBodyEcho && aRoundTrip && bRoundTrip

  console.log("\n=== VERDICT ===")
  console.log(`  Server generates UUID + echoes in header: ${badge(aHeaderBodyMatch)}`)
  console.log(`  Inbound x-trace-id is honored:            ${badge(bHeaderEcho && bBodyEcho)}`)
  console.log(`  Round-trip: header == ClickHouse row:     ${badge(aRoundTrip && bRoundTrip)}`)
  console.log(`  Overall:                                  ${badge(allPassed)}`)

  process.exitCode = allPassed ? 0 : 1
} catch (err) {
  console.error("Verify failed:", err)
  process.exitCode = 1
} finally {
  await client.close()
}
