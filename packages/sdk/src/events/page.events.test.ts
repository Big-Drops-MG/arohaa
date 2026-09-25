import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../core/tracker", () => ({
  track: vi.fn(),
}))

import { track } from "../core/tracker"
import {
  setupPageLeaveTracking,
  trackPageLeave,
} from "./page.events"

const trackMock = vi.mocked(track)

describe("page leave tracking", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("trackPageLeave emits page_leave", () => {
    vi.stubGlobal("document", { title: "Test Page" })
    trackPageLeave()
    expect(trackMock).toHaveBeenCalledWith("page_leave", {
      page_title: "Test Page",
    })
    vi.unstubAllGlobals()
  })

  it("setupPageLeaveTracking fires on hide and pagehide", () => {
    const visibilityListeners: Array<() => void> = []
    const pagehideListeners: Array<() => void> = []

    const doc = {
      title: "Leave Page",
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
    expect(trackMock).toHaveBeenCalledWith("page_leave", {
      page_title: "Leave Page",
    })

    trackMock.mockClear()
    pagehideListeners[0]!()
    expect(trackMock).toHaveBeenCalledWith("page_leave", {
      page_title: "Leave Page",
    })

    vi.unstubAllGlobals()
  })
})
