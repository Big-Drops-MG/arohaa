const API = "http://127.0.0.1:3001/v1/ingest"
const wid = "11111111-1111-4111-8111-111111111111"
const sid = "test-session-" + Math.random().toString(36).slice(2, 12)
const uid = "test-user-" + Math.random().toString(36).slice(2, 12)

const events = [
  {
    ev: "page_view",
    wid,
    sid,
    uid,
    ts: Date.now(),
    url: "https://united-flooring.expert/",
  },
  {
    ev: "checkout_started",
    wid,
    sid,
    uid,
    ts: Date.now(),
    url: "https://united-flooring.expert/cart",
    props: { cart_value: 299, currency: "USD" },
  },
  {
    ev: "cta_clicked",
    wid,
    sid,
    uid,
    ts: Date.now(),
    url: "https://united-flooring.expert/contact",
    props: { label: "Get a free quote", location: "sdk-test" },
  },
]

for (const e of events) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(e),
  })
  console.log(`-> ${e.ev}: ${res.status} ${await res.text()}`)
}

console.log("waiting 7s for buffer flush...")
await new Promise((r) => setTimeout(r, 7000))
console.log("done")
