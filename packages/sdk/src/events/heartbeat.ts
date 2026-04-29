import { trackMetric } from "../core/tracker"

const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_EVENT = "heartbeat"
const HEARTBEAT_METRIC = "engaged_seconds"

export function startHeartbeat(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return

  let tick = 0

  const handle = window.setInterval(() => {
    if (document.visibilityState !== "visible") return
    tick += 1
    trackMetric(
      HEARTBEAT_EVENT,
      HEARTBEAT_METRIC,
      tick * (HEARTBEAT_INTERVAL_MS / 1000),
      { tick, is_visible: true },
    )
  }, HEARTBEAT_INTERVAL_MS)

  window.addEventListener(
    "pagehide",
    () => window.clearInterval(handle),
    { capture: true, once: true },
  )
}
