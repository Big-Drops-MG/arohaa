const API = "http://127.0.0.1:3001/v1/ingest"

const payload = {
  ev: "web_vitals",
  wid: "11111111-1111-4111-8111-111111111111",
  uid: "test-inp-uid-aaaaaaaa",
  sid: "test-inp-sid-bbbbbbbb",
  fp: "abcd1234",
  ts: Date.now(),
  url: "http://localhost:3002/sdk-test",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "vitals_v2",
  utm_term: "",
  utm_content: "",
  referrer: "direct",
  metric_name: "INP",
  metric_value: 184.5,
  props: { metric: "INP" },
}

const res = await fetch(API, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
})
console.log(`-> ${res.status} ${await res.text()}`)
console.log("waiting 7s for buffer flush...")
await new Promise((r) => setTimeout(r, 7000))
console.log("done")
