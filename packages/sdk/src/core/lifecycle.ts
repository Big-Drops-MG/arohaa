import { track } from "./tracker"
import { trackPageView } from "../events/page.events"
import { setupScrollTracking } from "../events/scroll.events"
import { setupClickTracking } from "../events/click.events"
import { startHeartbeat } from "../events/heartbeat"
import { monitorWebVitals } from "../performance/vitals"
import { attemptSend } from "../services/network.service"
import { drainOutbox, setupOutboxDrainTriggers } from "../network/retry"
import { detectFaviconUrl } from "../utils/favicon"

export function setupLifecycle(): void {
  setupOutboxDrainTriggers(attemptSend)
  void drainOutbox(attemptSend)

  const faviconUrl = detectFaviconUrl()
  track("sdk_connected", faviconUrl ? { favicon_url: faviconUrl } : {})
  trackPageView()
  setupScrollTracking()
  setupClickTracking()
  startHeartbeat()
  monitorWebVitals()
}
