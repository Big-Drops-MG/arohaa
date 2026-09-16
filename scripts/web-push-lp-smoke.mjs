/**
 * Smoke-test LP → Arohaa subscribe/events with optional HMAC.
 *
 * Usage (from repo root):
 *   node scripts/web-push-lp-smoke.mjs
 *
 * Env:
 *   WEB_PUSH_AROHAA_API_BASE=https://api.arohaa.net
 *   WEB_PUSH_WEBHOOK_SECRET=wp_...   (optional until secret is configured)
 *   WEB_PUSH_SMOKE_WID=<landing page public UUID>
 *   WEB_PUSH_SMOKE_ENDPOINT=https://fcm.googleapis.com/fcm/send/smoke-test
 */

import { createHmac } from "node:crypto"

const apiBase = (
  process.env.WEB_PUSH_AROHAA_API_BASE ||
  process.env.INGEST_BASE_URL ||
  "http://127.0.0.1:3001"
).replace(/\/$/, "")
const secret = process.env.WEB_PUSH_WEBHOOK_SECRET?.trim() || ""
const wid = process.env.WEB_PUSH_SMOKE_WID?.trim()
const endpoint =
  process.env.WEB_PUSH_SMOKE_ENDPOINT?.trim() ||
  "https://fcm.googleapis.com/fcm/send/arohaa-smoke-test"

if (!wid) {
  console.error("Set WEB_PUSH_SMOKE_WID to a landing page public UUID")
  process.exit(1)
}

function sign(rawBody) {
  if (!secret) return null
  const hex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  return `sha256=${hex}`
}

async function post(path, body) {
  const rawBody = JSON.stringify(body)
  const headers = { "Content-Type": "application/json" }
  const sig = sign(rawBody)
  if (sig) headers["x-arohaa-web-push-signature"] = sig

  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers,
    body: rawBody,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  console.log(path, res.status, JSON.stringify(json))
  return { ok: res.ok, status: res.status, json }
}

const context = {
  wid,
  origin: "https://smoke.arohaa.local",
  page_url: "https://smoke.arohaa.local/?utm_source=smoke&zip=90210",
  timezone: "America/Los_Angeles",
  zip: "90210",
  step: 1,
}

const sub = await post("/v1/web-push/subscriptions", {
  action: "subscribe",
  subscription: {
    endpoint,
    expirationTime: null,
    keys: {
      p256dh: "BSmokeTestP256dhKeyBase64url________________",
      auth: "SmokeAuthKeyBase64url__",
    },
  },
  context,
})

const ev = await post("/v1/web-push/events", {
  event: "page_hidden",
  subscription_endpoint: endpoint,
  wid,
  occurred_at: new Date().toISOString(),
  context,
})

if (!sub.ok || !ev.ok) process.exit(1)
console.log("OK — subscribe + page_hidden accepted")
