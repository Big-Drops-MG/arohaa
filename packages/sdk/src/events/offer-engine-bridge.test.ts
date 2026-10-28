import { afterEach, describe, expect, it, vi } from "vitest"

async function loadBridge() {
  vi.resetModules()
  vi.doMock("./form.events", () => ({
    trackFormStart: vi.fn(),
    trackFormSubmit: vi.fn(),
    trackFormSuccess: vi.fn(),
  }))
  vi.doMock("./form-field-tracking", () => ({
    markFormSessionSucceeded: vi.fn(),
  }))

  const formEvents = await import("./form.events")
  const fieldTracking = await import("./form-field-tracking")
  const { setupOfferEngineBridge } = await import("./offer-engine-bridge")

  return {
    setupOfferEngineBridge,
    trackFormStart: vi.mocked(formEvents.trackFormStart),
    trackFormSubmit: vi.mocked(formEvents.trackFormSubmit),
    trackFormSuccess: vi.mocked(formEvents.trackFormSuccess),
    markFormSessionSucceeded: vi.mocked(
      fieldTracking.markFormSessionSucceeded,
    ),
  }
}

describe("offer-engine-bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("maps fill_* and redirect postMessages to form events", async () => {
    const listeners: Array<(event: MessageEvent) => void> = []
    vi.stubGlobal("window", {
      addEventListener: (
        type: string,
        handler: EventListenerOrEventListenerObject,
      ) => {
        if (type === "message" && typeof handler === "function") {
          listeners.push(handler as (event: MessageEvent) => void)
        }
      },
    })

    const bridge = await loadBridge()
    bridge.setupOfferEngineBridge()
    expect(listeners).toHaveLength(1)

    listeners[0]!({
      origin: "https://forms.offer-engine.com",
      data: { type: "fill__oe" },
    } as MessageEvent)

    expect(bridge.trackFormStart).toHaveBeenCalledWith("offer-engine")

    listeners[0]!({
      origin: "https://forms.offer-engine.com",
      data: { type: "redirect", url: "https://example.com/thanks" },
    } as MessageEvent)

    expect(bridge.trackFormSubmit).toHaveBeenCalledWith("offer-engine")
    expect(bridge.trackFormSuccess).toHaveBeenCalledWith("offer-engine")
    expect(bridge.markFormSessionSucceeded).toHaveBeenCalledWith(
      "offer-engine",
    )
  })

  it("ignores messages from other origins", async () => {
    const listeners: Array<(event: MessageEvent) => void> = []
    vi.stubGlobal("window", {
      addEventListener: (
        type: string,
        handler: EventListenerOrEventListenerObject,
      ) => {
        if (type === "message" && typeof handler === "function") {
          listeners.push(handler as (event: MessageEvent) => void)
        }
      },
    })

    const bridge = await loadBridge()
    bridge.setupOfferEngineBridge()
    listeners[0]!({
      origin: "https://evil.example",
      data: { type: "redirect", url: "https://evil.example" },
    } as MessageEvent)

    expect(bridge.trackFormSuccess).not.toHaveBeenCalled()
  })
})
