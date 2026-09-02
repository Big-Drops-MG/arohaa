import { describe, expect, it } from "vitest"
import {
  compositeLighthouseScore,
  rateWebVital,
  scoreWebVital,
} from "./web-vitals-score.js"

describe("web-vitals-score", () => {
  it("rates LCP thresholds", () => {
    expect(rateWebVital("LCP", 2000)).toBe("good")
    expect(rateWebVital("LCP", 3000)).toBe("needs-improvement")
    expect(rateWebVital("LCP", 5000)).toBe("poor")
  })

  it("rates FCP thresholds", () => {
    expect(rateWebVital("FCP", 1200)).toBe("good")
    expect(rateWebVital("FCP", 2200)).toBe("needs-improvement")
    expect(rateWebVital("FCP", 3500)).toBe("poor")
  })

  it("scores good metrics near 90–100", () => {
    expect(scoreWebVital("LCP", 2000)).toBeGreaterThanOrEqual(90)
    expect(scoreWebVital("FCP", 1200)).toBeGreaterThanOrEqual(90)
    expect(scoreWebVital("CLS", 0.05)).toBeGreaterThanOrEqual(90)
    expect(scoreWebVital("INP", 150)).toBeGreaterThanOrEqual(90)
  })

  it("composites lighthouse score from available vitals", () => {
    const score = compositeLighthouseScore({
      FCP: 1200,
      LCP: 2000,
      CLS: 0.05,
      INP: 150,
    })
    expect(score).not.toBeNull()
    expect(score!).toBeGreaterThanOrEqual(90)
  })

  it("returns null when no vitals present", () => {
    expect(compositeLighthouseScore({})).toBeNull()
  })
})
