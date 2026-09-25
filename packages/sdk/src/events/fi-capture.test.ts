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
    expect(FI_MSG.selected).toBe("selected")
    expect(FI_MSG.formStarted).toBe("form started")
    expect(FI_MSG.formSubmitted).toBe("form submitted")
    expect(FI_MSG.formCompleted).toBe("form completed")
    expect(FI_MSG.inSep).toBe(" in ")
    expect(FI_MSG.digit).toBe("digit")
    expect(FI_MSG.letter).toBe("letter")
    expect(FI_MSG.space).toBe("space")
    expect(FI_MSG.symbol).toBe("symbol")
    expect(FI_MSG.star).toBe("*")
    expect(FI_MSG.pasted).toBe("pasted")
    expect(FI_MSG.copied).toBe("copied")
    expect(FI_MSG.cut).toBe("cut")
  })
})

describe("fi message builders", () => {
  it("formats typed and pressed messages", () => {
    expect(__fiTest.formatTyped("5", "email")).toBe("typed '5' in [email]")
    expect(__fiTest.formatPressed("Control+v", "email")).toBe(
      "pressed 'Control+v' in [email]",
    )
  })

  it("labels clipboard shortcuts", () => {
    expect(
      __fiTest.shortcutLabel({
        key: "v",
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false,
      } as KeyboardEvent),
    ).toBe("Control+v")
    expect(
      __fiTest.shortcutLabel({
        key: "V",
        ctrlKey: false,
        altKey: false,
        metaKey: true,
        shiftKey: false,
      } as KeyboardEvent),
    ).toBe("Meta+v")
    expect(__fiTest.isClipboardShortcut("Control+v")).toBe("paste")
    expect(__fiTest.isClipboardShortcut("Meta+c")).toBe("copy")
    expect(__fiTest.isClipboardShortcut("Control+x")).toBe("cut")
    expect(__fiTest.formatPasted("email")).toBe("pasted in [email]")
    expect(__fiTest.formatCopied("email")).toBe("copied in [email]")
    expect(__fiTest.formatCut("email")).toBe("cut in [email]")
  })

  it("masks phone keystrokes like TrustedForm", () => {
    expect(__fiTest.formatTyped("5", "phone", true)).toBe(
      "typed 'digit' in [phone]",
    )
    expect(__fiTest.formatTyped("a", "mobile_number", true)).toBe(
      "typed 'letter' in [mobile_number]",
    )
    expect(__fiTest.formatTyped("-", "phone", true)).toBe(
      "typed 'symbol' in [phone]",
    )
    expect(__fiTest.formatTyped(" ", "phone", true)).toBe(
      "typed 'space' in [phone]",
    )
  })

  it("formats click, change, and selected messages", () => {
    expect(__fiTest.formatClicked("submit")).toBe("clicked on [submit]")
    expect(__fiTest.formatChanged("hello", "email")).toBe(
      'changed value to "hello" in [email]',
    )
    expect(__fiTest.formatSelected("Yes", "insured")).toBe(
      'selected "Yes" in [insured]',
    )
  })

  it("masks phone values like TrustedForm", () => {
    expect(__fiTest.formatChanged("5551234567", "phone", true)).toBe(
      'changed value to "**********" in [phone]',
    )
    expect(__fiTest.formatChanged("555", "mobile_number", true)).toBe(
      'changed value to "**********" in [mobile_number]',
    )
    expect(__fiTest.maskPhoneValue("12")).toBe("**********")
  })

  it("detects phone field keys", () => {
    expect(__fiTest.isPhoneFieldKey("phone")).toBe(true)
    expect(__fiTest.isPhoneFieldKey("mobile_number")).toBe(true)
    expect(__fiTest.isPhoneFieldKey("PhoneNumber")).toBe(true)
    expect(__fiTest.isPhoneFieldKey("email")).toBe(false)
    expect(__fiTest.isPhoneFieldKey("telephone_consent")).toBe(false)
  })

  it("formats step messages", () => {
    expect(__fiTest.formatStep("viewed", 2, "vehicle")).toBe(
      "step 2:vehicle viewed",
    )
    expect(__fiTest.formatStep("completed", 1)).toBe("step 1 completed")
  })
})
