import { describe, expect, it } from "vitest"
import { FI_EV, FI_MSG, FI_PROP } from "./fi-tokens"
import { __fiTest } from "./fi-capture"

describe("fi-tokens", () => {
  it("decodes opaque wire names", () => {
    expect(FI_EV).toBe("_fi")
    expect(FI_PROP).toBe("_k")
  })

  it("decodes message fragments", () => {
    expect(FI_MSG.typed).toBe("typed")
    expect(FI_MSG.pressed).toBe("pressed")
    expect(FI_MSG.clickedOn).toBe("clicked on")
    expect(FI_MSG.changedTo).toBe("changed value to")
    expect(FI_MSG.inSep).toBe(" in ")
  })
})

describe("fi message builders", () => {
  it("formats typed and pressed messages", () => {
    expect(__fiTest.formatTyped("5", "phone")).toBe("typed '5' in [phone]")
    expect(__fiTest.formatPressed("Control+v", "email")).toBe(
      "pressed 'Control+v' in [email]",
    )
  })

  it("formats click and change messages", () => {
    expect(__fiTest.formatClicked("submit")).toBe("clicked on [submit]")
    expect(__fiTest.formatChanged("5551234", "phone")).toBe(
      'changed value to "5551234" in [phone]',
    )
  })
})
