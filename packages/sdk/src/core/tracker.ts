import { sendEvent } from "./sender"
import { isAllowedSdkEventName } from "../events/allowed-events"

export function track(
  event: string,
  props: Record<string, unknown> = {},
): void {
  if (typeof event !== "string" || !isAllowedSdkEventName(event)) {
    return
  }
  sendEvent(event, props)
}

export function trackMetric(
  event: string,
  metric_name: string,
  metric_value: number,
  props: Record<string, unknown> = {},
): void {
  if (!Number.isFinite(metric_value)) return
  if (typeof event !== "string" || !isAllowedSdkEventName(event)) {
    return
  }
  sendEvent(event, props, { metric_name, metric_value })
}
