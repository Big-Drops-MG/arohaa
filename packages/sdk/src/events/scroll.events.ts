import { track } from "../core/tracker"
import { getScrollPercent } from "../utils/helpers"

const firedThresholds = new Set<number>()

export function setupScrollTracking(): void {
  window.addEventListener("scroll", () => {
    const percent = getScrollPercent()
    const thresholds = [25, 50, 75, 90]

    for (const t of thresholds) {
      if (percent >= t && !firedThresholds.has(t)) {
        firedThresholds.add(t)
        track(`scroll_${t}`)
      }
    }
  })
}
