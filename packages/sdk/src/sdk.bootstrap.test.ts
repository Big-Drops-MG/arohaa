import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./index", () => ({
  initSDK: vi.fn(async () => {
    throw new Error("init boom")
  }),
  isSDKInitializedState: vi.fn(() => false),
  track: vi.fn(),
}))

describe("sdk bootstrap fail-safe", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("does not rethrow when initSDK fails", async () => {
    ;(globalThis as unknown as { window: Window }).window = {
      arohaa: { q: [], l: Date.now() },
    } as unknown as Window

    const { bootstrap } = await import("./sdk.js")
    await expect(bootstrap()).resolves.toBeUndefined()
  })
})
