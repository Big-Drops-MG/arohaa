import { track } from "./tracker"
import { trackPageView } from "../events/page.events"
import { setupScrollTracking } from "../events/scroll.events"
import { setupClickTracking } from "../events/click.events"
import { startHeartbeat } from "../events/heartbeat"
import { monitorWebVitals } from "../performance/vitals"
import { attemptSend } from "../services/network.service"
import { drainOutbox, setupOutboxDrainTriggers } from "../network/retry"

export function setupLifecycle(): void {
  setupOutboxDrainTriggers(attemptSend)
  void drainOutbox(attemptSend)

  track("sdk_connected")
  trackPageView()
  setupScrollTracking()
  setupClickTracking()
  startHeartbeat()
  monitorWebVitals()
}
