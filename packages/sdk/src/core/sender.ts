import { buildEvent } from "../model/event"
import { sendRequest } from "../services/network.service"

export function sendEvent(
  event: string,
  props: Record<string, unknown> = {},
): void {
  const payload = buildEvent(event, props)
  sendRequest(payload)
}
