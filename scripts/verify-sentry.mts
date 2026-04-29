const API = "http://127.0.0.1:3001"

async function hit(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  console.log(`-> ${method} ${path} -> ${res.status} ${text}`)
  return { status: res.status, body: text }
}

console.log("=== 1. /v1/_status (should report sentry status) ===")
await hit("GET", "/v1/_status")

console.log("\n=== 2. /v1/_sentry-check (should 500, generic message) ===")
await hit("GET", "/v1/_sentry-check")

console.log("\n=== 3. /v1/ingest with bad body (should 400, schema message, NOT sent to sentry) ===")
await hit("POST", "/v1/ingest", { ev: "BAD!!!", wid: "not-a-uuid" })

console.log("\n=== 4. /v1/ingest with valid body (should 202) ===")
await hit("POST", "/v1/ingest", {
  ev: "sentry_smoke_test",
  wid: "11111111-1111-4111-8111-111111111111",
  uid: "smoke-test-uid-aaaa",
  sid: "smoke-test-sid-bbbb",
  fp: "1234abcd",
  url: "http://localhost",
})
