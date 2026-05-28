const BASE = "http://127.0.0.1:3001"

interface Probe {
  label: string
  method: "GET" | "POST"
  path: string
  expectedStatus: number
  body?: unknown
  inboundTraceId?: string
}

const probes: Probe[] = [
  {
    label: "202 valid ingest",
    method: "POST",
    path: "/v1/ingest",
    expectedStatus: 202,
    body: {
      ev: "trace_test_err",
      wid: "11111111-1111-4111-8111-111111111111",
      sid: "err-sid-12345678",
      uid: "err-uid-12345678",
    },
  },
  {
    label: "400 schema-validation failure",
    method: "POST",
    path: "/v1/ingest",
    expectedStatus: 400,
    body: { ev: "missing_required_fields" },
  },
  {
    label: "500 unhandled exception (sentry-check)",
    method: "GET",
    path: "/v1/_sentry-check",
    expectedStatus: 500,
  },
  {
    label: "404 unknown route",
    method: "GET",
    path: "/v1/does-not-exist",
    expectedStatus: 404,
  },
  {
    label: "client-supplied trace id on 500",
    method: "GET",
    path: "/v1/_sentry-check",
    expectedStatus: 500,
    inboundTraceId: "support-ticket-42",
  },
]

function badge(passed: boolean): string {
  return passed ? "PASS" : "FAIL"
}

let allPass = true

for (const p of probes) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  if (p.inboundTraceId) headers["x-trace-id"] = p.inboundTraceId

  const res = await fetch(BASE + p.path, {
    method: p.method,
    headers,
    body: p.body ? JSON.stringify(p.body) : undefined,
  })

  const traceId = res.headers.get("x-trace-id")
  const text = await res.text()
  let bodyTraceId: string | null = null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed.trace_id === "string") {
      bodyTraceId = parsed.trace_id
    }
  } catch {
    // not JSON, that's ok
  }

  const statusOk = res.status === p.expectedStatus
  const headerPresent = traceId !== null && traceId.length > 0
  const inboundEcho = p.inboundTraceId ? traceId === p.inboundTraceId : true
  const bodyMatch = bodyTraceId === null || bodyTraceId === traceId
  const ok = statusOk && headerPresent && inboundEcho && bodyMatch

  if (!ok) allPass = false

  console.log(`\n[${badge(ok)}] ${p.label}`)
  console.log(`  status:        ${res.status} (expected ${p.expectedStatus}) ${badge(statusOk)}`)
  console.log(`  x-trace-id:    ${traceId ?? "(missing)"} ${badge(headerPresent)}`)
  if (p.inboundTraceId) {
    console.log(`  inbound echo:  ${badge(inboundEcho)}`)
  }
  if (bodyTraceId !== null) {
    console.log(`  body trace_id: ${bodyTraceId} (matches header: ${badge(bodyMatch)})`)
  }
  console.log(`  body:          ${text.slice(0, 200)}`)
}

console.log(`\n=== OVERALL: ${badge(allPass)} ===`)
process.exitCode = allPass ? 0 : 1
