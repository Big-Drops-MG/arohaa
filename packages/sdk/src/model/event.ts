import type { EventPayload } from "../types"
import { getCookie } from "../services/cookie.service"
import { getConfig } from "./config"

export function buildEvent(
  event: string,
  props: Record<string, unknown> = {},
): EventPayload {
  const config = getConfig()

  return {
    wid: config.wid,
    uid: getCookie("aro_uid"),
    sid: getCookie("aro_sid"),
    ev: event,
    ts: Date.now(),
    url: window.location.href,
    page: config.page,
    variant: config.variant,
    formtype: config.formtype,
    props,
  }
}
