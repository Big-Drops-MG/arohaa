import { track } from "./tracker"
import { trackPageView } from "../events/page.events"
import { setupScrollTracking } from "../events/scroll.events"
import { setupClickTracking } from "../events/click.events"

export function setupLifecycle(): void {
  track("sdk_connected")
  trackPageView()
  setupScrollTracking()
  setupClickTracking()
}
