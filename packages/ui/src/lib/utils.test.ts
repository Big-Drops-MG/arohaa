import { cn } from "./utils.js"

describe("cn", () => {
  it("merges conflicting tailwind utilities", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
  })
})
