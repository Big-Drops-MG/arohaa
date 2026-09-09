import { afterEach, describe, expect, it } from "vitest"
import {
  consumeAuthHistoryTrap,
  getAuthHistoryFloor,
  markAuthHistoryTrap,
  setAuthHistoryFloor,
} from "@/lib/auth-navigation"

type MutableGlobal = { window?: unknown }

function stubSessionStorage() {
  const store = new Map<string, string>()
  ;(globalThis as MutableGlobal).window = {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  }
}

afterEach(() => {
  delete (globalThis as MutableGlobal).window
})

describe("auth history trap", () => {
  it("is consumable once, and only by the marked target", () => {
    stubSessionStorage()
    markAuthHistoryTrap("login")

    expect(consumeAuthHistoryTrap("app")).toBe(false)
    expect(consumeAuthHistoryTrap("login")).toBe(true)
    expect(consumeAuthHistoryTrap("login")).toBe(false)
  })

  it("survives the 2FA hop through /login during provider sign-in", () => {
    stubSessionStorage()
    markAuthHistoryTrap("app")

    expect(consumeAuthHistoryTrap("login")).toBe(false)
    expect(consumeAuthHistoryTrap("app")).toBe(true)
  })

  it("no-ops without a window", () => {
    expect(consumeAuthHistoryTrap("app")).toBe(false)
    expect(getAuthHistoryFloor()).toBeNull()
  })
})

describe("auth history floor", () => {
  it("persists the floor so a reload does not lose it", () => {
    stubSessionStorage()

    expect(getAuthHistoryFloor()).toBeNull()
    setAuthHistoryFloor("/dashboard")
    expect(getAuthHistoryFloor()).toBe("/dashboard")
    expect(getAuthHistoryFloor()).toBe("/dashboard")
  })

  it("moves the floor when a later auth step lands elsewhere", () => {
    stubSessionStorage()

    setAuthHistoryFloor("/dashboard")
    setAuthHistoryFloor("/login")
    expect(getAuthHistoryFloor()).toBe("/login")
  })
})
