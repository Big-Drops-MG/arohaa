import { isTypingTarget } from "./theme-provider"

describe("isTypingTarget", () => {
  it("returns true for INPUT elements", () => {
    const input = document.createElement("input")
    expect(isTypingTarget(input)).toBe(true)
  })

  it("returns true for TEXTAREA elements", () => {
    const textarea = document.createElement("textarea")
    expect(isTypingTarget(textarea)).toBe(true)
  })

  it("returns true for SELECT elements", () => {
    const select = document.createElement("select")
    expect(isTypingTarget(select)).toBe(true)
  })

  it("returns true for contentEditable elements", () => {
    const div = document.createElement("div")
    div.contentEditable = "true"
    expect(isTypingTarget(div)).toBe(true)
  })

  it("returns false for non-typing elements", () => {
    const div = document.createElement("div")
    expect(isTypingTarget(div)).toBe(false)

    const span = document.createElement("span")
    expect(isTypingTarget(span)).toBe(false)
  })

  it("returns false for null", () => {
    expect(isTypingTarget(null)).toBe(false)
  })

  it("returns false for non-HTMLElement targets", () => {
    const textNode = document.createTextNode("hello")
    expect(isTypingTarget(textNode as unknown as EventTarget)).toBe(false)

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    expect(isTypingTarget(svg as unknown as EventTarget)).toBe(false)
  })
})
