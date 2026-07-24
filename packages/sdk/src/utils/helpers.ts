export function getDocumentSize(): { width: number; height: number } {
  const body = document.body
  const html = document.documentElement

  // Never floor to clientHeight / innerHeight. Those are the viewport, and once an
  // iframe preview is resized to a reported height they create a feedback loop:
  // measured height ≥ iframe height forever, which leaves trailing white space
  // and shifts page-relative heatmap coordinates upward.
  const scrollWidth = Math.max(
    body?.scrollWidth ?? 0,
    body?.offsetWidth ?? 0,
    html?.scrollWidth ?? 0,
    html?.offsetWidth ?? 0,
    1
  )
  const scrollHeight = Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    html?.scrollHeight ?? 0,
    html?.offsetHeight ?? 0,
    1
  )

  // Prefer the bottom/right edge of in-flow root children when scroll metrics are
  // inflated by min-height: 100vh (common on landing pages).
  let contentRight = 0
  let contentBottom = 0
  const root = body ?? html
  if (root) {
    const scrollX = window.scrollX || window.pageXOffset || 0
    const scrollY = window.scrollY || window.pageYOffset || 0
    for (let i = 0; i < root.children.length; i += 1) {
      const el = root.children[i]
      if (!(el instanceof HTMLElement)) continue
      const style = window.getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") continue
      if (style.position === "fixed") continue
      const rect = el.getBoundingClientRect()
      contentRight = Math.max(contentRight, rect.right + scrollX)
      contentBottom = Math.max(contentBottom, rect.bottom + scrollY)
    }
  }

  const width =
    contentRight > 0 && scrollWidth > contentRight + 1
      ? Math.ceil(contentRight)
      : Math.max(Math.ceil(contentRight), scrollWidth)
  const height =
    contentBottom > 0 && scrollHeight > contentBottom + 1
      ? Math.ceil(contentBottom)
      : Math.max(Math.ceil(contentBottom), scrollHeight)

  return { width: Math.max(1, width), height: Math.max(1, height) }
}

export function getPageNorm(clientX: number, clientY: number): {
  px: number
  py: number
} {
  const { width, height } = getDocumentSize()
  const scrollX = window.scrollX || window.pageXOffset || 0
  const scrollY = window.scrollY || window.pageYOffset || 0
  const px = (scrollX + clientX) / width
  const py = (scrollY + clientY) / height
  return {
    px: Number.isFinite(px) ? Math.min(1, Math.max(0, px)) : 0,
    py: Number.isFinite(py) ? Math.min(1, Math.max(0, py)) : 0,
  }
}

export function getScrollPercent(): number {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const docHeight = Math.max(
    document.body?.scrollHeight ?? 0,
    document.documentElement?.scrollHeight ?? 0
  )
  const scrollable = docHeight - window.innerHeight
  if (scrollable <= 0) return 0
  const percent = (scrollTop / scrollable) * 100
  if (!Number.isFinite(percent)) return 0
  if (percent < 0) return 0
  if (percent > 100) return 100
  return percent
}

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}
