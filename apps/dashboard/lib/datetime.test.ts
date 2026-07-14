import { describe, expect, it } from "vitest"
import {
  addDashboardDays,
  formatDashboardDateTime,
  getDashboardZonedParts,
  startOfDashboardDay,
} from "./datetime"

describe("dashboard Eastern timezone", () => {
  it("displays winter and summer instants with Eastern DST offsets", () => {
    expect(formatDashboardDateTime("2026-01-15T17:00:00.000Z")).toBe(
      "Jan 15, 2026, 12:00 PM"
    )
    expect(formatDashboardDateTime("2026-07-15T16:00:00.000Z")).toBe(
      "Jul 15, 2026, 12:00 PM"
    )
  })

  it("uses 23-hour and 25-hour Eastern calendar days at DST transitions", () => {
    const springStart = startOfDashboardDay(
      new Date("2026-03-08T12:00:00.000Z")
    )
    const fallStart = startOfDashboardDay(new Date("2026-11-01T12:00:00.000Z"))

    expect(
      addDashboardDays(springStart, 1).getTime() - springStart.getTime()
    ).toBe(23 * 60 * 60 * 1000)
    expect(addDashboardDays(fallStart, 1).getTime() - fallStart.getTime()).toBe(
      25 * 60 * 60 * 1000
    )
  })

  it("maps both repeated fall-back instants to Eastern 1 AM", () => {
    expect(
      getDashboardZonedParts(new Date("2026-11-01T05:00:00.000Z")).hour
    ).toBe(1)
    expect(
      getDashboardZonedParts(new Date("2026-11-01T06:00:00.000Z")).hour
    ).toBe(1)
  })
})
