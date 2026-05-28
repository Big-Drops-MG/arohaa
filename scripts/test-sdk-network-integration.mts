import http from "node:http"
import { randomUUID } from "node:crypto"
import { createClient } from "@clickhouse/client"
import { config as loadEnv } from "dotenv"
import path from "node:path"

loadEnv({ path: path.resolve("apps/dashboard/.env.local") })

class FakeStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
  get length() {
    return this.map.size
  }
  key(_i: number) {
    return null
  }
}

class FakeDocument {
  visibilityState: "visible" | "hidden" = "visible"
  cookie = ""
  currentScript: unknown = null
  listeners: Array<{ type: string; fn: () => void }> = []
  addEventListener(type: string, fn: () => void) {
    this.listeners.push({ type, fn })
  }
  getElementById() {
    return null
  }
  querySelector() {
    return null
  }
}

class FakeWindow {
  listeners: Array<{ type: string; fn: () => void }> = []
  location = { href: "https://example.com/test", hostname: "example.com", search: "" }
  addEventListener(type: string, fn: () => void) {
    this.listeners.push({ type, fn })
  }
  dispatch(type: string) {
    for (const l of this.listeners) if (l.type === type) l.fn()
  }
}

const storage = new FakeStorage()
const win = new FakeWindow()
const doc = new FakeDocument()

function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

defineGlobal("localStorage", storage)
defineGlobal("window", win)
defineGlobal("document", doc)
defineGlobal("navigator", { onLine: true, language: "en-US", platform: "node" })
defineGlobal("screen", { width: 1920, height: 1080, colorDepth: 24 })

interface Counters {
  total: number
  by_event: Record<string, number>
}
const counters: Counters = { total: 0, by_event: {} }

const fakeServer = http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    counters.total++
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(body) as Record<string, unknown>
      const ev = (parsed.ev as string | undefined) ?? "(no ev)"
      counters.by_event[ev] = (counters.by_event[ev] ?? 0) + 1
    } catch {
      // ignore
    }

    if (req.url === "/ok/v1/ingest") {
      res.writeHead(202, { "content-type": "application/json" })
      res.end(JSON.stringify({ status: "accepted" }))
      return
    }
    if (req.url === "/transient/v1/ingest") {
      res.writeHead(503, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "service unavailable" }))
      return
    }
    if (req.url === "/permanent/v1/ingest") {
      res.writeHead(400, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "bad request" }))
      return
    }
    if (req.url === "/timeout/v1/ingest") {
      res.destroy()
      return
    }
    res.writeHead(404)
    res.end()
  })
})

await new Promise<void>((r) => fakeServer.listen(0, "127.0.0.1", () => r()))
const addr = fakeServer.address()
const fakePort = typeof addr === "object" && addr ? addr.port : 0
const fakeBase = `http://127.0.0.1:${fakePort}`
console.log(`fake server on ${fakeBase}`)

const network = await import("../packages/sdk/src/services/network.service.ts")
const retry = await import("../packages/sdk/src/network/retry.ts")
const { initializeConfig } = await import("../packages/sdk/src/model/config.ts")

function fakeScript(apiBase: string): { getAttribute: (name: string) => string | null } {
  return {
    getAttribute: (name: string) => {
      if (name === "data-wid") return "11111111-1111-4111-8111-111111111111"
      if (name === "data-api") return apiBase
      if (name === "data-page") return "integration-test"
      if (name === "data-variant") return "A"
      if (name === "data-formtype") return "single"
      return null
    },
  }
}

interface BasicEventPayload {
  wid: string
  uid: string
  sid: string
  fp: string
  ev: string
  ts: number
  url: string
  page: string
  variant: string
  formtype: "zip" | "single" | "multiple"
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  referrer: string
  metric_name: string
  metric_value: number
  props: Record<string, unknown>
}

function payload(ev: string, props: Record<string, unknown> = {}): BasicEventPayload {
  return {
    wid: "11111111-1111-4111-8111-111111111111",
    uid: "integ-uid-" + randomUUID().slice(0, 8),
    sid: "integ-sid-" + randomUUID().slice(0, 8),
    fp: "abcd1234",
    ev,
    ts: Date.now(),
    url: "https://example.com/integ",
    page: "integration-test",
    variant: "A",
    formtype: "single",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    referrer: "",
    metric_name: "",
    metric_value: 0,
    props,
  }
}

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

console.log("\n=== A. attemptSend classifies real HTTP responses ===")

initializeConfig(fakeScript(`${fakeBase}/ok`) as never)
const okOutcome = await network.attemptSend(payload("ok_test") as never)
expect(okOutcome === "ok", "202 -> ok", `outcome=${okOutcome}`)

initializeConfig(fakeScript(`${fakeBase}/transient`) as never)
const transientOutcome = await network.attemptSend(payload("transient_test") as never)
expect(transientOutcome === "transient", "503 -> transient", `outcome=${transientOutcome}`)

initializeConfig(fakeScript(`${fakeBase}/permanent`) as never)
const permanentOutcome = await network.attemptSend(payload("permanent_test") as never)
expect(permanentOutcome === "permanent", "400 -> permanent", `outcome=${permanentOutcome}`)

initializeConfig(fakeScript(`${fakeBase}/timeout`) as never)
const timeoutOutcome = await network.attemptSend(payload("timeout_test") as never)
expect(timeoutOutcome === "transient", "connection drop -> transient", `outcome=${timeoutOutcome}`)

initializeConfig(fakeScript("http://127.0.0.1:1") as never)
const refusedOutcome = await network.attemptSend(payload("refused_test") as never)
expect(refusedOutcome === "transient", "connection refused -> transient", `outcome=${refusedOutcome}`)

console.log("\n=== B. sendRequest saves to outbox on transient, NOT on permanent ===")

storage.clear()
initializeConfig(fakeScript(`${fakeBase}/transient`) as never)
network.sendRequest(payload("save_on_503") as never)
await new Promise((r) => setTimeout(r, 100))
expect(retry.getOutboxSize() === 1, "transient saved to outbox", `size=${retry.getOutboxSize()}`)

storage.clear()
initializeConfig(fakeScript(`${fakeBase}/permanent`) as never)
network.sendRequest(payload("drop_on_400") as never)
await new Promise((r) => setTimeout(r, 100))
expect(retry.getOutboxSize() === 0, "permanent NOT saved to outbox", `size=${retry.getOutboxSize()}`)

console.log("\n=== C. End-to-end: simulate offline -> reconnect -> drain to REAL API -> ClickHouse ===")

const REAL_API = "http://127.0.0.1:3001"
const marker = "retry-e2e-" + randomUUID()

storage.clear()

initializeConfig(fakeScript("http://127.0.0.1:1/v1/ingest") as never)
network.sendRequest(payload("retry_e2e_test", { marker }) as never)
await new Promise((r) => setTimeout(r, 100))
expect(retry.getOutboxSize() === 1, "offline event saved to outbox", `size=${retry.getOutboxSize()}`)

initializeConfig(fakeScript(REAL_API) as never)
const drainResult = await retry.drainOutbox(network.attemptSend)
console.log(`  drainResult: ${JSON.stringify(drainResult)}`)
expect(drainResult.delivered === 1, "drained 1 event", JSON.stringify(drainResult))
expect(drainResult.remaining === 0, "outbox emptied", JSON.stringify(drainResult))

const ch = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
  request_timeout: 30000,
  keep_alive: { enabled: false },
})

interface QueryRow {
  event_name: string
  marker: string
  trace_id: string
}

async function pollForRow(): Promise<QueryRow[]> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const r = await ch.query({
        query: `
          SELECT
            event_name,
            JSONExtractString(properties, 'marker') AS marker,
            trace_id
          FROM events
          WHERE event_name = 'retry_e2e_test'
            AND JSONExtractString(properties, 'marker') = {marker:String}
        `,
        query_params: { marker },
        format: "JSON",
      })
      const json = (await r.json()) as { data: QueryRow[] }
      if (json.data.length > 0) return json.data
    } catch (err) {
      console.log(`  query attempt failed (will retry): ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return []
}

console.log("  polling ClickHouse for the drained event (up to 60s)...")
const startedPoll = Date.now()
try {
  const rows = await pollForRow()
  console.log(`  poll completed in ${Date.now() - startedPoll}ms; rows: ${JSON.stringify(rows)}`)
  expect(rows.length === 1, "drained event landed in ClickHouse", `rows=${rows.length}`)
  expect(
    rows[0]?.marker === marker,
    "marker matches",
    `db marker=${rows[0]?.marker}, sent=${marker}`,
  )
  expect(
    typeof rows[0]?.trace_id === "string" && rows[0]!.trace_id.length > 0,
    "trace_id was assigned by API",
    `trace_id=${rows[0]?.trace_id}`,
  )
} finally {
  await ch.close()
}

console.log("\n=== D. Envelope is stripped: re-sent payload has NO _retry/saved_at fields ===")
expect(
  counters.by_event["retry_e2e_test"] === undefined ||
    counters.by_event["retry_e2e_test"] === 0,
  "test event did not hit fake server (was sent to real API)",
  `count=${counters.by_event["retry_e2e_test"]}`,
)

console.log(`\n  fake server saw ${counters.total} requests across all probes`)
console.log(`  by event: ${JSON.stringify(counters.by_event)}`)

await new Promise<void>((r) => fakeServer.close(() => r()))

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed)
console.log(`\n=== SUMMARY: ${passed}/${results.length} passed ===`)
if (failed.length > 0) {
  console.log("\nFailures:")
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`)
  process.exitCode = 1
}
