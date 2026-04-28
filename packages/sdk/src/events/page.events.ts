import { track } from "../core/tracker"

export function trackPageView(): void {
  track("page_view")
}

export function trackPageLeave(): void {
  track("page_leave")
}
