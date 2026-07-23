import { track } from "./tracker"
import { trackPageView } from "../events/page.events"
import { setupScrollTracking } from "../events/scroll.events"
import { setupClickTracking } from "../events/click.events"
import { setupAttentionTracking } from "../events/attention.events"
import { setupFormTracking } from "../events/form-tracking"
import { startHeartbeat } from "../events/heartbeat"
import { monitorWebVitals } from "../performance/vitals"
import { attemptSend } from "../services/network.service"
import { drainOutbox, setupOutboxDrainTriggers } from "../network/retry"
import { flushBatcher, setupBatcherUnloadHooks } from "./batcher"

export function setupLifecycle(): void {
  setupOutboxDrainTriggers(attemptSend)
  void drainOutbox(attemptSend)
  setupBatcherUnloadHooks()

  track("sdk_connected", {})
  trackPageView()
  setupScrollTracking()
  setupClickTracking()
  setupAttentionTracking()
  setupFormTracking()
  startHeartbeat()
  monitorWebVitals()

  window.addEventListener("pagehide", () => {
    void flushBatcher()
  })
}
