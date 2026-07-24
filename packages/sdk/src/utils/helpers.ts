export function getDocumentSize(): { width: number; height: number } {
  const body = document.body
  const html = document.documentElement
  const width = Math.max(
    body?.scrollWidth ?? 0,
    body?.offsetWidth ?? 0,
    html?.clientWidth ?? 0,
    html?.scrollWidth ?? 0,
    html?.offsetWidth ?? 0,
    window.innerWidth || 0,
    1,
  )
  const height = Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    html?.clientHeight ?? 0,
    html?.scrollHeight ?? 0,
    html?.offsetHeight ?? 0,
    window.innerHeight || 0,
    1,
  )
  return { width, height }
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
    document.documentElement?.scrollHeight ?? 0,
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
