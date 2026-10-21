import { describe, expect, it } from "vitest"
import { withRetryAttempt } from "./retry"

describe("retry traceability", () => {
  it("changes retry_id but keeps event_id and batch_id stable", () => {
    const original = {
      event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      retry_id: undefined as string | undefined,
      wid: "w",
      uid: "u",
      sid: "s",
      fp: "f",
      ev: "page_view",
      ts: Date.now(),
      url: "https://example.com",
      page: "example.com",
      variant: "A",
      formtype: "single" as const,
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_term: "",
      utm_content: "",
      utm_id: "",
      utm_s1: "",
      referrer: "",
      metric_name: "",
      metric_value: 0,
      props: {},
    }

    const next = withRetryAttempt(original)
    expect(next.event_id).toBe(original.event_id)
    expect(next.batch_id).toBe(original.batch_id)
    expect(next.retry_id).toBeTruthy()
    expect(next.retry_id).not.toBe(original.retry_id)

    const again = withRetryAttempt(next)
    expect(again.event_id).toBe(original.event_id)
    expect(again.batch_id).toBe(original.batch_id)
    expect(again.retry_id).not.toBe(next.retry_id)
  })
})
