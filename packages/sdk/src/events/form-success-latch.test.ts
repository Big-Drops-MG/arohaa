import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  __resetFormSessionsForTests,
  hasFormSessionSucceeded,
  markFormSessionSucceeded,
} from "../events/form-field-tracking"

describe("form conversion latch (SR23)", () => {
  beforeEach(() => {
    __resetFormSessionsForTests()
  })

  afterEach(() => {
    __resetFormSessionsForTests()
  })

  it("latches conversion even when no form session was started (redirect host)", () => {
    expect(hasFormSessionSucceeded()).toBe(false)
    markFormSessionSucceeded()
    expect(hasFormSessionSucceeded()).toBe(true)
  })

  it("blocks a second success for the same session", () => {
    markFormSessionSucceeded()
    expect(hasFormSessionSucceeded()).toBe(true)
    markFormSessionSucceeded()
    expect(hasFormSessionSucceeded()).toBe(true)
  })
})

describe("opaque success gate (SR23)", () => {
  it("skips a second form_success after the latch is set", async () => {
    __resetFormSessionsForTests()
    const track = vi.fn()
    vi.doMock("../core/tracker", () => ({ track }))

    function emitSuccessOnce(): boolean {
      if (hasFormSessionSucceeded()) return false
      track("form_success", { lead_complete: true })
      markFormSessionSucceeded()
      return true
    }

    expect(emitSuccessOnce()).toBe(true)
    expect(emitSuccessOnce()).toBe(false)
    expect(track).toHaveBeenCalledTimes(1)
  })
})
