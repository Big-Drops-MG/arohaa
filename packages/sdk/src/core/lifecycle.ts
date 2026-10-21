import { track } from "./tracker"
import { setupSpaPageViews, setupPageLeaveTracking, trackPageView } from "../events/page.events"
import { setupScrollTracking } from "../events/scroll.events"
import { setupClickTracking } from "../events/click.events"
import { setupAttentionTracking } from "../events/attention.events"
import { setupFormTracking } from "../events/form-tracking"
import { installFormSemantics } from "../events/form.events"
import { setupServiceClickTracking } from "../events/service-click.events"
import { setupOpaqueFieldCapture } from "../events/opaque-field-capture"
import { setupFiCapture } from "../events/fi-capture"
import { setupBehaviorSummary } from "../events/behavior-summary"
import { setupPageIntegrityObservations } from "../events/page-integrity"
import { setupRedirectLinkStamping } from "./redirect-stamp"
import { startHeartbeat } from "../events/heartbeat"
import { monitorWebVitals } from "../performance/vitals"
import { attemptSend } from "../services/network.service"
import { drainOutbox, setupOutboxDrainTriggers } from "../network/retry"
import { flushBatcher, setupBatcherUnloadHooks } from "./batcher"
import { getConfig } from "../model/config"
import { getRemoteRedirectHostname } from "./sdk-config"
import { setupWebPushLifecycleBridge } from "./web-push-lifecycle"
import { collectBrowserObservations } from "../utils/browser-obs"
import { getSdkInitStartedAt } from "./init-timing"

export function setupLifecycle(): void {
  installFormSemantics()
  setupOutboxDrainTriggers(attemptSend)
  void drainOutbox(attemptSend)
  setupBatcherUnloadHooks()

  const initMs = getSdkInitStartedAt()
  track("sdk_connected", {
    browser_obs: collectBrowserObservations(),
    sdk_init_ms: initMs > 0 ? Date.now() - initMs : null,
  })
  trackPageView()
  setupSpaPageViews()
  setupPageLeaveTracking()
  setupScrollTracking()
  setupClickTracking()
  setupAttentionTracking()
  const host = typeof window !== "undefined" ? window.location.hostname : ""
  const redirectHost = getRemoteRedirectHostname()
  const onRedirectHost = Boolean(
    redirectHost && host.toLowerCase() === redirectHost.toLowerCase(),
  )

  setupFormTracking({
    trackFieldFocus: !onRedirectHost,
    trackFormSuccess: !onRedirectHost,
  })
  if (getConfig().formtype !== "none") {
    setupFiCapture()
  }
  setupBehaviorSummary()
  setupServiceClickTracking()
  setupRedirectLinkStamping()
  setupPageIntegrityObservations()

  if (onRedirectHost) {
    setupOpaqueFieldCapture()
  } else if (getConfig().formtype === "zip") {
  }

  startHeartbeat()
  monitorWebVitals()
  setupWebPushLifecycleBridge()

  window.addEventListener("pagehide", () => {
    void flushBatcher()
  })
}
