import http from "k6/http"
import { check, sleep } from "k6"

const ingestUrl =
  __ENV.INGEST_URL?.trim() || "http://127.0.0.1:3001/v1/ingest"
const workspaceId =
  __ENV.WORKSPACE_ID?.trim() || "11111111-1111-4111-8111-111111111111"

export const options = {
  scenarios: {
    ingest_steady: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.K6_RATE || 20),
      timeUnit: "1s",
      duration: __ENV.K6_DURATION || "30s",
      preAllocatedVUs: Number(__ENV.K6_VUS || 10),
      maxVUs: Number(__ENV.K6_MAX_VUS || 50),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<800"],
  },
}

export default function ingestLoadTest() {
  const payload = JSON.stringify({
    ev: "page_view",
    wid: workspaceId,
    sid: `k6-${__VU}-${__ITER}-${Date.now()}`,
    uid: `k6-user-${__VU}`,
    ts: Date.now(),
    url: "https://load-test.example.com/",
  })

  const response = http.post(ingestUrl, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "ingest" },
  })

  check(response, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  })

  sleep(0.05)
}

export function handleSummary(data) {
  const passed = data.metrics.checks?.values?.passes ?? 0
  const failed = data.metrics.checks?.values?.fails ?? 0
  return {
    stdout: `k6 ingest load test complete: ${passed} checks passed, ${failed} failed\n`,
  }
}
