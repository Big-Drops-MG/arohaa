import { createClient } from "@clickhouse/client"
import { config } from "dotenv"
import path from "node:path"
import { randomUUID } from "node:crypto"

config({ path: path.resolve("apps/dashboard/.env.local") })

const API = "http://127.0.0.1:3001"
const ch = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
  request_timeout: 30000,
  keep_alive: { enabled: false },
})

interface CaseResult {
  name: string
  passed: boolean
  detail: string
}
const results: CaseResult[] = []
function expect(cond: boolean, name: string, detail: string) {
  results.push({ name, passed: cond, detail })
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`)
}

const runMarker = "ops-" + randomUUID()
console.log(`run marker: ${runMarker}\n`)

interface IngestPayload {
  ev: string
  wid: string
  sid: string
  uid: string
  ts: number
  url: string
  referrer?: string
  props?: Record<string, unknown>
}

async function sendEvent(
  payload: IngestPayload,
  userAgent?: string,
): Promise<{ status: number; body: unknown; traceHeader: string | null }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  if (userAgent) headers["user-agent"] = userAgent

  const res = await fetch(`${API}/v1/ingest`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })
  const traceHeader = res.headers.get("x-trace-id")
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = await res.text()
  }
  return { status: res.status, body, traceHeader }
}

const wid = "11111111-1111-4111-8111-111111111111"

console.log("=== ARHT29: /health ===")

const h = await fetch(`${API}/health`)
const hBody = (await h.json()) as Record<string, unknown>
expect(h.status === 200, "health returns 200", `status=${h.status}`)
expect(hBody.status === "ok", "health status='ok'", JSON.stringify(hBody))
expect(
  (hBody.dependencies as Record<string, string>)?.clickhouse === "ok",
  "ClickHouse dependency reported ok",
  JSON.stringify(hBody.dependencies),
)
expect(
  typeof hBody.latency_ms === "number" && (hBody.latency_ms as number) >= 0,
  "latency_ms field present",
  `latency=${hBody.latency_ms}`,
)
expect(
  typeof hBody.trace_id === "string" && (hBody.trace_id as string).length > 0,
  "trace_id present in body",
  `trace_id=${hBody.trace_id}`,
)
expect(
  h.headers.get("x-trace-id") === hBody.trace_id,
  "x-trace-id response header matches body",
  `header=${h.headers.get("x-trace-id")} body=${hBody.trace_id}`,
)

console.log("\n=== ARHT26+27: enrichment & referrer normalization ===")

const scenarios = [
  {
    name: "chrome_windows_google",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    referrer: "https://www.google.co.in/search?q=arohaa",
    expectBrowser: "Chrome",
    expectOs: "Windows",
    expectDevice: "desktop",
    expectRefSource: "Google",
  },
  {
    name: "iphone_facebook",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    referrer: "https://l.facebook.com/l.php?u=https://united-flooring.expert/",
    expectBrowser: "Mobile Safari",
    expectOs: "iOS",
    expectDevice: "mobile",
    expectRefSource: "Facebook",
  },
  {
    name: "android_xtwitter",
    ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    referrer: "https://t.co/abcd1234",
    expectBrowser: "Mobile Chrome",
    expectOs: "Android",
    expectDevice: "mobile",
    expectRefSource: "X/Twitter",
  },
  {
    name: "no_ua_no_referrer",
    ua: undefined,
    referrer: "direct",
    expectBrowser: "Unknown",
    expectOs: "Unknown",
    expectDevice: "desktop",
    expectRefSource: "direct",
  },
  {
    name: "unknown_referrer",
    ua: "Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0",
    referrer: "https://some-blog.example.com/post-123",
    expectBrowser: "Firefox",
    expectOs: "Linux",
    expectDevice: "desktop",
    expectRefSource: "some-blog.example.com",
  },
]

for (const s of scenarios) {
  const r = await sendEvent(
    {
      ev: "ops_test",
      wid,
      sid: "ops-sid-" + randomUUID().slice(0, 8),
      uid: "ops-uid-" + randomUUID().slice(0, 8),
      ts: Date.now(),
      url: "https://united-flooring.expert/test",
      referrer: s.referrer,
      props: { runMarker, scenario: s.name },
    },
    s.ua,
  )
  expect(
    r.status === 202,
    `${s.name}: 202 accepted`,
    `status=${r.status} body=${JSON.stringify(r.body)}`,
  )
}

console.log("\n=== Polling ClickHouse for enriched rows ===")

interface EnrichedRow {
  scenario: string
  browser: string
  os: string
  device: string
  country: string
  city: string
  referrer: string
  referrer_source: string
  trace_id: string
}

async function pollForRows(): Promise<EnrichedRow[]> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const r = await ch.query({
        query: `
          SELECT
            JSONExtractString(properties, 'scenario') AS scenario,
            browser,
            os,
            device,
            country,
            city,
            referrer,
            referrer_source,
            trace_id
          FROM events
          WHERE event_name = 'ops_test'
            AND JSONExtractString(properties, 'runMarker') = {marker:String}
          ORDER BY scenario
        `,
        query_params: { marker: runMarker },
        format: "JSON",
      })
      const json = (await r.json()) as { data: EnrichedRow[] }
      if (json.data.length >= scenarios.length) return json.data
    } catch (err) {
      console.log(`  query attempt failed (will retry): ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return []
}

const rows = await pollForRows()
console.log(`\n  found ${rows.length} rows\n`)
console.log(JSON.stringify(rows, null, 2))

const byScenario = new Map(rows.map((r) => [r.scenario, r]))
for (const s of scenarios) {
  const row = byScenario.get(s.name)
  expect(row !== undefined, `${s.name}: row landed`, "")
  if (!row) continue
  expect(row.browser === s.expectBrowser, `${s.name}: browser=${s.expectBrowser}`, `got=${row.browser}`)
  expect(row.os === s.expectOs, `${s.name}: os=${s.expectOs}`, `got=${row.os}`)
  expect(row.device === s.expectDevice, `${s.name}: device=${s.expectDevice}`, `got=${row.device}`)
  expect(
    row.referrer_source === s.expectRefSource,
    `${s.name}: referrer_source=${s.expectRefSource}`,
    `got=${row.referrer_source}`,
  )
  expect(
    row.country === "Unknown",
    `${s.name}: country defaults to 'Unknown' (geo stub)`,
    `got=${row.country}`,
  )
}

console.log("\n=== ARHT27 detail: raw 'referrer' is preserved (not overwritten) ===")
const fb = byScenario.get("iphone_facebook")
if (fb) {
  expect(
    fb.referrer.includes("facebook.com"),
    "raw referrer URL preserved with full path/query",
    `referrer=${fb.referrer}`,
  )
  expect(
    fb.referrer_source === "Facebook",
    "referrer_source is normalized name",
    `referrer_source=${fb.referrer_source}`,
  )
}

console.log("\n=== ARHT28: rate limiting on /v1/ingest ===")

const burst = 605
const rateLimitMarker = "rl-" + randomUUID()
const promises: Array<Promise<{ status: number; body: unknown; traceHeader: string | null }>> = []
for (let i = 0; i < burst; i++) {
  promises.push(
    sendEvent({
      ev: "rate_limit_probe",
      wid,
      sid: "rl-sid-" + i.toString().padStart(6, "0"),
      uid: "rl-uid-12345678",
      ts: Date.now(),
      url: "https://example.com",
      props: { rateLimitMarker, i },
    }),
  )
}
const responses = await Promise.all(promises)

const statusCounts = new Map<number, number>()
for (const r of responses) {
  statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1)
}
console.log(
  `  status distribution: ${JSON.stringify(Object.fromEntries(statusCounts))}`,
)

const accepted = statusCounts.get(202) ?? 0
const rateLimited = statusCounts.get(429) ?? 0

expect(accepted > 0 && accepted <= 600, "200-600 requests accepted (limit=600/min)", `accepted=${accepted}`)
expect(rateLimited > 0, "rate limit triggered (some 429s)", `429s=${rateLimited}`)
expect(accepted + rateLimited === burst, "every response was either 202 or 429", `accepted+limited=${accepted + rateLimited}`)

const sampleRateLimited = responses.find((r) => r.status === 429)
if (sampleRateLimited) {
  const body = sampleRateLimited.body as Record<string, unknown>
  console.log(`  sample 429: ${JSON.stringify(body)}`)
  expect(
    body.error === "Too Many Requests",
    "429 has 'Too Many Requests' error name",
    `got=${body.error}`,
  )
  expect(
    typeof body.message === "string" && (body.message as string).includes("Rate limit"),
    "429 message mentions rate limit",
    `got=${body.message}`,
  )
  expect(
    typeof body.trace_id === "string" && (body.trace_id as string).length > 0,
    "429 envelope carries trace_id",
    `trace_id=${body.trace_id}`,
  )
  expect(
    sampleRateLimited.traceHeader === body.trace_id,
    "x-trace-id response header matches 429 body",
    `header=${sampleRateLimited.traceHeader} body=${body.trace_id}`,
  )
}

console.log("\n=== /health is exempt from rate limit (still 200 after burst) ===")
const hAfter = await fetch(`${API}/health`)
expect(
  hAfter.status === 200,
  "/health remains accessible during rate-limit lockout",
  `status=${hAfter.status}`,
)

await ch.close()

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed)
console.log(`\n=== SUMMARY: ${passed}/${results.length} passed ===`)
if (failed.length > 0) {
  console.log("\nFailures:")
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
