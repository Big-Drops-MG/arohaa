import { sendEvent } from "./sender"

export function track(
  event: string,
  props: Record<string, unknown> = {},
): void {
  sendEvent(event, props)
}
