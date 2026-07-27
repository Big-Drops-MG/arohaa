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
    {
      source: MESSAGE_SOURCE,
      type: "doc-size",
      width,
      height,
      // Advertise scroll control so the dashboard can keep the iframe at a
      // real device viewport (correct 100vh layout) and sync scroll itself.
      features: ["scroll-to"],
    },
    "*"
  )
}

function postScroll(): void {
  const target = window.parent
  if (!target) return
  target.postMessage(
    {
      source: MESSAGE_SOURCE,
      type: "scroll",
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0,
    },
    "*"
  )
}

function onParentMessage(event: MessageEvent): void {
  const data = event.data as
    | { source?: string; type?: string; x?: number; y?: number }
    | undefined
  if (!data || data.source !== MESSAGE_SOURCE) return

  if (data.type === "ping") {
    postDocSize()
    postScroll()
    return
  }

  if (data.type === "scroll-to") {
    const x = Number(data.x)
    const y = Number(data.y)
    window.scrollTo({
      left: Number.isFinite(x) ? x : 0,
      top: Number.isFinite(y) ? y : 0,
      behavior: "auto",
    })
  }
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
  window.addEventListener("message", onParentMessage)

  if (typeof ResizeObserver !== "undefined" && document.documentElement) {
    const ro = new ResizeObserver(schedule)
    ro.observe(document.documentElement)
    if (document.body) ro.observe(document.body)
  }

  for (const delay of [300, 800, 1500, 3000]) {
    window.setTimeout(schedule, delay)
  }
}
