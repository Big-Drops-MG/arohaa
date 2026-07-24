import { getDocumentSize } from "../utils/helpers"

const MESSAGE_SOURCE = "arohaa-heatmap"

function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

function postDocSize(): void {
  const { width, height } = getDocumentSize()
  const target = window.parent
  if (!target) return
  target.postMessage(
    { source: MESSAGE_SOURCE, type: "doc-size", width, height },
    "*",
  )
}

export function setupFrameSizeReporter(): void {
  if (typeof window === "undefined") return
  if (!isFramed()) return

  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      postDocSize()
    })
  }

  schedule()
  window.addEventListener("load", schedule)
  window.addEventListener("resize", schedule)

  if (typeof ResizeObserver !== "undefined" && document.documentElement) {
    const ro = new ResizeObserver(schedule)
    ro.observe(document.documentElement)
    if (document.body) ro.observe(document.body)
  }

  for (const delay of [300, 800, 1500, 3000]) {
    window.setTimeout(schedule, delay)
  }
}
