import { track } from "./tracker"
import { trackPageView } from "../events/page.events"
import { setupScrollTracking } from "../events/scroll.events"
import { setupClickTracking } from "../events/click.events"
import { setupAttentionTracking } from "../events/attention.events"
import { setupFormTracking } from "../events/form-tracking"
import { setupServiceClickTracking } from "../events/service-click.events"
import { setupOpaqueFieldCapture } from "../events/opaque-field-capture"
import { setupRedirectLinkStamping } from "./redirect-stamp"
import { startHeartbeat } from "../events/heartbeat"
import { monitorWebVitals } from "../performance/vitals"
import { attemptSend } from "../services/network.service"
import { drainOutbox, setupOutboxDrainTriggers } from "../network/retry"
import { flushBatcher, setupBatcherUnloadHooks } from "./batcher"
import { getConfig } from "../model/config"
import { getRemoteRedirectHostname } from "./sdk-config"

export function setupLifecycle(): void {
  setupOutboxDrainTriggers(attemptSend)
  void drainOutbox(attemptSend)
  setupBatcherUnloadHooks()

  track("sdk_connected", {})
  trackPageView()
  setupScrollTracking()
  setupClickTracking()
  setupAttentionTracking()
  const host = typeof window !== "undefined" ? window.location.hostname : ""
  const redirectHost = getRemoteRedirectHostname()
  const onRedirectHost = Boolean(
    redirectHost && host.toLowerCase() === redirectHost.toLowerCase(),
  )

  setupFormTracking({ trackFieldFocus: !onRedirectHost })
  setupServiceClickTracking()
  setupRedirectLinkStamping()

  if (onRedirectHost) {
    setupOpaqueFieldCapture()
  } else if (getConfig().formtype === "zip") {
    // zip page only stamps links; no full-field capture
  }

  startHeartbeat()
  monitorWebVitals()

  window.addEventListener("pagehide", () => {
    void flushBatcher()
  })
}
