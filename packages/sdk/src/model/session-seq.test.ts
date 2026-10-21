import { afterEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, string>()

vi.mock("../services/storage.service", () => ({
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
}))

vi.mock("./identity", () => ({
  getIdentity: () => ({ sid: "session-shared", uid: "user-1" }),
}))

import { nextSessionSeq } from "./session-seq"

describe("session seq multi-tab CAS", () => {
  afterEach(() => {
    store.clear()
  })

  it("never reuses the same sequence for sequential callers sharing sid", () => {
    const seen = new Set<number>()
    for (let i = 0; i < 50; i += 1) {
      const seq = nextSessionSeq()
      expect(seen.has(seq)).toBe(false)
      seen.add(seq)
    }
    expect(seen.size).toBe(50)
  })
})
