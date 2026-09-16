import type { EventPayload, MetricExtension } from "../types"
import { getAttributionData, safePageUrl } from "../utils/url"
import { getConfig } from "./config"
import { getIdentity } from "./identity"
import { generateUUID } from "../utils/uuid"

export function buildEvent(
  event: string,
  props: Record<string, unknown> = {},
  metric?: MetricExtension,
): EventPayload {
  const config = getConfig()
  const identity = getIdentity()
  const attribution = getAttributionData()

  return {
    event_id: generateUUID(),
    wid: config.wid,
    ...(config.lpId.trim() ? { lp_id: config.lpId.trim() } : {}),
    uid: identity.uid,
    sid: identity.sid,
    fp: identity.fp,
    ev: event,
    ts: Date.now(),
    url: safePageUrl(),
    page: config.page,
    variant: config.variant,
    formtype: config.formtype,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    utm_id: attribution.utm_id,
    utm_s1: attribution.utm_s1,
    referrer: attribution.referrer,
    metric_name: metric?.metric_name ?? "",
    metric_value: metric?.metric_value ?? 0,
    props,
  }
}
