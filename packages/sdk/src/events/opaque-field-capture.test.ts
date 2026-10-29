import { describe, expect, it } from "vitest"
import { __opaqueFieldTest } from "./opaque-field-capture"

describe("opaque field choice helpers", () => {
  it("maps credit step names to credit_rating", () => {
    expect(__opaqueFieldTest.fieldKeyFromStepName("Credit Rating")).toBe(
      "credit_rating",
    )
    expect(__opaqueFieldTest.fieldKeyFromStepName("credit-score")).toBe(
      "credit_rating",
    )
  })

  it("maps other common funnel steps", () => {
    expect(__opaqueFieldTest.fieldKeyFromStepName("Homeowner")).toBe("homeowner")
    expect(__opaqueFieldTest.fieldKeyFromStepName("Military Affiliation")).toBe(
      "military_affiliation",
    )
    expect(__opaqueFieldTest.fieldKeyFromStepName("Currently Insured")).toBe(
      "currently_insured",
    )
  })

  it("recognizes credit button labels used on live LPs", () => {
    expect(__opaqueFieldTest.CREDIT_CHOICE_RE.test("Excellent (701+)")).toBe(
      true,
    )
    expect(__opaqueFieldTest.CREDIT_CHOICE_RE.test("Good (640–700)")).toBe(true)
    expect(__opaqueFieldTest.CREDIT_CHOICE_RE.test("Fair (560–639)")).toBe(true)
    expect(__opaqueFieldTest.CREDIT_CHOICE_RE.test("Poor (559 Or Less)")).toBe(
      true,
    )
    expect(__opaqueFieldTest.CREDIT_CHOICE_RE.test("Good / Excellent")).toBe(
      true,
    )
    expect(__opaqueFieldTest.CREDIT_CHOICE_RE.test("Next")).toBe(false)
  })

  it("rejects nav CTAs as choice values", () => {
    expect(__opaqueFieldTest.NAV_CHOICE_RE.test("Next")).toBe(true)
    expect(__opaqueFieldTest.NAV_CHOICE_RE.test("Continue")).toBe(true)
    expect(__opaqueFieldTest.NAV_CHOICE_RE.test("Get Quotes")).toBe(true)
    expect(
      __opaqueFieldTest.isPlausibleChoiceValue("credit_rating", "Next"),
    ).toBe(false)
    expect(
      __opaqueFieldTest.isPlausibleChoiceValue(
        "credit_rating",
        "Excellent (701+)",
      ),
    ).toBe(true)
  })

  it("peels driver_0_credit_* radio keys including banded labels", () => {
    expect(
      __opaqueFieldTest.peelRadioField("driver_0_credit_Excellent", "on"),
    ).toEqual({ key: "driver_0_credit", value: "Excellent" })
    expect(
      __opaqueFieldTest.peelRadioField(
        "driver_0_credit_Excellent",
        "Excellent (701+)",
      ),
    ).toEqual({ key: "driver_0_credit", value: "Excellent" })
  })
})
