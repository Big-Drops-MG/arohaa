export interface IngestEventBody {
  ev: string
  wid: string
  uid: string
  sid: string
  fp?: string
  ts?: number
  url?: string
  page?: string
  variant?: string
  formtype?: 'zip' | 'single' | 'multiple'
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrer?: string
  metric_name?: string
  metric_value?: number
  props?: Record<string, unknown>
}

export interface EventRow {
  event_name: string
  workspace_id: string
  user_id: string
  session_id: string
  fingerprint: string
  url: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  referrer: string
  referrer_source: string
  browser: string
  os: string
  device: string
  country: string
  city: string
  metric_name: string
  metric_value: number
  properties: string
  trace_id: string
  created_at: string
}

export interface EnrichmentForRow {
  referrerSource: string
  browser: string
  os: string
  device: string
  country: string
  city: string
}

export function ingestBodyToEventRow(
  body: IngestEventBody,
  traceId: string,
  enrichment: EnrichmentForRow,
): EventRow {
  return {
    event_name: body.ev,
    workspace_id: body.wid,
    user_id: body.uid,
    session_id: body.sid,
    fingerprint: body.fp ?? '',
    url: body.url ?? '',
    utm_source: body.utm_source ?? '',
    utm_medium: body.utm_medium ?? '',
    utm_campaign: body.utm_campaign ?? '',
    utm_term: body.utm_term ?? '',
    utm_content: body.utm_content ?? '',
    referrer: body.referrer ?? '',
    referrer_source: enrichment.referrerSource,
    browser: enrichment.browser,
    os: enrichment.os,
    device: enrichment.device,
    country: enrichment.country,
    city: enrichment.city,
    metric_name: body.metric_name ?? '',
    metric_value: typeof body.metric_value === 'number' && Number.isFinite(body.metric_value)
      ? body.metric_value
      : 0,
    properties: serializeProps(body.props),
    trace_id: traceId,
    created_at: toClickHouseDateTime64(new Date()),
  }
}

function serializeProps(props: Record<string, unknown> | undefined): string {
  if (!props) return '{}'
  try {
    return JSON.stringify(props)
  } catch {
    return '{}'
  }
}

function toClickHouseDateTime64(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const yyyy = date.getUTCFullYear()
  const mm = pad(date.getUTCMonth() + 1)
  const dd = pad(date.getUTCDate())
  const hh = pad(date.getUTCHours())
  const mi = pad(date.getUTCMinutes())
  const ss = pad(date.getUTCSeconds())
  const ms = pad(date.getUTCMilliseconds(), 3)
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`
}
