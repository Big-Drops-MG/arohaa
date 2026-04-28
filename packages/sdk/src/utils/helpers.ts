export function getScrollPercent(): number {
  const scrollTop = window.scrollY
  const docHeight = document.body.scrollHeight - window.innerHeight
  if (docHeight <= 0) return 0
  return (scrollTop / docHeight) * 100
}

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}
