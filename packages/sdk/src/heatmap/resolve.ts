import { getDocumentSize } from "../utils/helpers"

export type HeatmapResolveInput = {
  id: string
  /** Page-relative fallback (0–1). */
  px: number
  py: number
  /** Element-relative offset within the selector target (0–1). */
  ex?: number | null
  ey?: number | null
  selector?: string | null
}

export type HeatmapResolveOutput = {
  id: string
  /** Absolute CSS pixels in the current document. */
  x: number
  y: number
  method: "element" | "page"
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Crazy Egg / PostHog-style placement:
 * 1. Prefer element-anchored coords (selector + offset inside the element)
 * 2. Fall back to page-relative fractions of the live document
 *
 * Element anchoring survives responsive reflow as long as the selector still
 * resolves; page-relative covers moves and orphaned selectors.
 */
export function resolveHeatmapPoints(
  inputs: HeatmapResolveInput[]
): { points: HeatmapResolveOutput[]; width: number; height: number } {
  const { width, height } = getDocumentSize()
  const scrollX = window.scrollX || window.pageXOffset || 0
  const scrollY = window.scrollY || window.pageYOffset || 0

  const points: HeatmapResolveOutput[] = inputs.map((input) => {
    const selector = input.selector?.trim() || ""
    const ex = input.ex
    const ey = input.ey

    if (
      selector &&
      typeof ex === "number" &&
      typeof ey === "number" &&
      Number.isFinite(ex) &&
      Number.isFinite(ey)
    ) {
      try {
        const el = document.querySelector(selector)
        if (el instanceof Element) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            return {
              id: input.id,
              x: rect.left + scrollX + clamp01(ex) * rect.width,
              y: rect.top + scrollY + clamp01(ey) * rect.height,
              method: "element" as const,
            }
          }
        }
      } catch {
        // Invalid selector — fall through to page coords.
      }
    }

    return {
      id: input.id,
      x: clamp01(input.px) * width,
      y: clamp01(input.py) * height,
      method: "page" as const,
    }
  })

  return { points, width, height }
}
