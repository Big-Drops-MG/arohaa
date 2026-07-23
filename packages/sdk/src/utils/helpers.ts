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
