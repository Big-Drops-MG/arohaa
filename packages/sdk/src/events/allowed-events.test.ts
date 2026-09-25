import { describe, expect, it } from "vitest"
import {
  ALLOWED_SDK_EVENT_NAMES,
  isAllowedSdkEventName,
} from "../events/allowed-events"

describe("allowed SDK event names", () => {
  it("allows known product events", () => {
    expect(isAllowedSdkEventName("page_view")).toBe(true)
    expect(isAllowedSdkEventName("page_leave")).toBe(true)
    expect(isAllowedSdkEventName("form_success")).toBe(true)
    expect(isAllowedSdkEventName("form_field_abandon")).toBe(true)
    expect(isAllowedSdkEventName("heatmap_click")).toBe(true)
    expect(isAllowedSdkEventName("_fi")).toBe(true)
  })

  it("rejects arbitrary custom names", () => {
    expect(isAllowedSdkEventName("custom_hack")).toBe(false)
    expect(isAllowedSdkEventName("")).toBe(false)
    expect(isAllowedSdkEventName("../drop_table")).toBe(false)
  })

  it("has a stable non-empty allowlist", () => {
    expect(ALLOWED_SDK_EVENT_NAMES.length).toBeGreaterThan(10)
  })
})
