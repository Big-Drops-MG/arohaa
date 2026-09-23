import { describe, expect, it } from "vitest"
import { ANALYTICS_ALERT_SYNC_RANGES } from "./analytics-alert-sync-ranges.js"

describe("analytics alert inbox sync", () => {
  it("syncs both 7d and last_month so monthly_form_hike can enter the inbox", () => {
    expect(ANALYTICS_ALERT_SYNC_RANGES).toEqual(["7d", "last_month"])
  })
})
