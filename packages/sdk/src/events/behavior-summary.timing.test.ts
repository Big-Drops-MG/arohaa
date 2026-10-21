import { afterEach, describe, expect, it, vi } from "vitest"
import { __behaviorTimingTest } from "./behavior-summary"

describe("behavior timing", () => {
  afterEach(() => {
    __behaviorTimingTest.reset()
    vi.useRealTimers()
  })

  it("accumulates visible time when becoming hidden", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    __behaviorTimingTest.setWasVisible(true)
    __behaviorTimingTest.setVisibleStarted(Date.now())

    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"))
    __behaviorTimingTest.onVisibilityChange(false)

    expect(__behaviorTimingTest.getVisibleMs()).toBe(5000)
  })

  it("caps active time with inactivity cutoff", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    __behaviorTimingTest.noteInteraction()
    vi.advanceTimersByTime(__behaviorTimingTest.ACTIVE_IDLE_MS + 20_000)
    expect(__behaviorTimingTest.getActiveMs()).toBe(
      __behaviorTimingTest.ACTIVE_IDLE_MS,
    )
  })
})
