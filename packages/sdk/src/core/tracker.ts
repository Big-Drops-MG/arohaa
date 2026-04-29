import { sendEvent } from "./sender"

export function track(
  event: string,
  props: Record<string, unknown> = {},
): void {
  sendEvent(event, props)
}

export function trackMetric(
  event: string,
  metric_name: string,
  metric_value: number,
  props: Record<string, unknown> = {},
): void {
  if (!Number.isFinite(metric_value)) return
  sendEvent(event, props, { metric_name, metric_value })
}
