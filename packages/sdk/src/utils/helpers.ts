export function getDocumentSize(): { width: number; height: number } {
  const body = document.body
  const html = document.documentElement
  const scrollX = window.scrollX || window.pageXOffset || 0
  const scrollY = window.scrollY || window.pageYOffset || 0

  // True content extent — never floor to clientHeight/innerHeight (those create a
  // 100vh feedback loop once a heatmap iframe is resized to the reported height).
  let contentRight = 0
  let contentBottom = 0

  try {
    if (body) {
      const range = document.createRange()
      range.selectNodeContents(body)
      const rect = range.getBoundingClientRect()
      contentRight = Math.max(contentRight, rect.right + scrollX)
      contentBottom = Math.max(contentBottom, rect.bottom + scrollY)
    }
  } catch {
    // Range can throw on detached trees; fall through to child scan.
  }

  const root = body ?? html
  if (root) {
    for (let i = 0; i < root.children.length; i += 1) {
      const el = root.children[i]
      if (!(el instanceof HTMLElement)) continue
      if (el.id === "arohaa-heatmap-overlay") continue
      const style = window.getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") continue
      if (style.position === "fixed") continue
      const rect = el.getBoundingClientRect()
      contentRight = Math.max(contentRight, rect.right + scrollX)
      contentBottom = Math.max(contentBottom, rect.bottom + scrollY)
    }
  }

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

  // Prefer measured content. Only use scroll metrics when content could not be
  // measured — scrollHeight often equals a stretched 100vh iframe shell.
  const width =
    contentRight > 1
      ? Math.ceil(contentRight)
      : Math.max(1, Math.ceil(scrollWidth))
  const height =
    contentBottom > 1
      ? Math.ceil(contentBottom)
      : Math.max(1, Math.ceil(scrollHeight))

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
