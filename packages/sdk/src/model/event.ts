import type { EventPayload, MetricExtension } from "../types"
import { getAttributionData } from "../utils/url"
import { getConfig } from "./config"
import { getIdentity } from "./identity"

export function buildEvent(
  event: string,
  props: Record<string, unknown> = {},
  metric?: MetricExtension,
): EventPayload {
  const config = getConfig()
  const identity = getIdentity()
  const attribution = getAttributionData()

  return {
    wid: config.wid,
    uid: identity.uid,
    sid: identity.sid,
    fp: identity.fp,
    ev: event,
    ts: Date.now(),
    url: window.location.href,
    page: config.page,
    variant: config.variant,
    formtype: config.formtype,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    referrer: attribution.referrer,
    metric_name: metric?.metric_name ?? "",
    metric_value: metric?.metric_value ?? 0,
    props,
  }
}
