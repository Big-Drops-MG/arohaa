import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../core/tracker", () => ({
  track: vi.fn(),
}))

import { track } from "../core/tracker"
import {
  setupPageLeaveTracking,
  trackPageLeave,
} from "./page.events"

describe("page leave tracking", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("trackPageLeave emits page_leave", () => {
    trackPageLeave()
    expect(track).toHaveBeenCalledWith("page_leave")
  })

  it("setupPageLeaveTracking fires on hide and pagehide", () => {
    const visibilityListeners: Array<() => void> = []
    const pagehideListeners: Array<() => void> = []

    const doc = {
      visibilityState: "visible" as DocumentVisibilityState,
      addEventListener: (
        type: string,
        handler: EventListenerOrEventListenerObject,
      ) => {
        if (type === "visibilitychange" && typeof handler === "function") {
          visibilityListeners.push(handler as () => void)
        }
      },
    }

    const win = {
      addEventListener: (
        type: string,
        handler: EventListenerOrEventListenerObject,
      ) => {
        if (type === "pagehide" && typeof handler === "function") {
          pagehideListeners.push(handler as () => void)
        }
      },
    }

    vi.stubGlobal("document", doc)
    vi.stubGlobal("window", win)

    setupPageLeaveTracking()

    expect(visibilityListeners).toHaveLength(1)
    expect(pagehideListeners).toHaveLength(1)

    doc.visibilityState = "hidden"
    visibilityListeners[0]!()
    expect(track).toHaveBeenCalledWith("page_leave")

    track.mockClear()
    pagehideListeners[0]!()
    expect(track).toHaveBeenCalledWith("page_leave")

    vi.unstubAllGlobals()
  })
})
