import { buildEvent } from "../model/event"
import { sendRequest } from "../services/network.service"
import type { MetricExtension } from "../types"
import { enqueueHeatmapEvent } from "./batcher"
import { isHeatmapSessionSampled } from "./sdk-config"

function isHeatmapEventName(event: string): boolean {
  return event.startsWith("heatmap_")
}

export function sendEvent(
  event: string,
  props: Record<string, unknown> = {},
  metric?: MetricExtension,
): void {
  if (isHeatmapEventName(event)) {
    if (!isHeatmapSessionSampled()) return
    const payload = buildEvent(event, props, metric)
    enqueueHeatmapEvent(payload)
    return
  }

  const payload = buildEvent(event, props, metric)
  sendRequest(payload)
}
