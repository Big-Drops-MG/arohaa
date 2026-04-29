import { buildEvent } from "../model/event"
import { sendRequest } from "../services/network.service"
import type { MetricExtension } from "../types"

export function sendEvent(
  event: string,
  props: Record<string, unknown> = {},
  metric?: MetricExtension,
): void {
  const payload = buildEvent(event, props, metric)
  sendRequest(payload)
}
