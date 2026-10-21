import {
  materializeOpaqueProps,
  sealFiPropsForStorage,
  sealPropsForStorage,
  FI_EVENT_NAME,
} from '../lib/field-blob.js'
import { extractContactHashesFromProps } from '../lib/lead-fraud/contact-hash.js'

export interface IngestEventBody {
  event_id?: string
  ev?: string
  event_name?: string
  wid?: string
  workspace_id?: string
  uid: string
  sid: string
  lp_id?: string
  fp?: string
  ts?: number
  url?: string
  page?: string
  variant?: string
  formtype?: 'zip' | 'single' | 'multiple' | 'none'
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  utm_id?: string
  utm_s1?: string
  referrer?: string
  metric_name?: string
  metric_value?: number
  props?: Record<string, unknown>
  sdk_version?: string
  sdk_capabilities?: string
  seq?: number
  session_token?: string
  batch_id?: string
  retry_id?: string
}

export interface EventRow {
  event_id: string
  event_name: string
  workspace_id: string
  tenant_workspace_id: string
  lp_public_id: string
  user_id: string
  session_id: string
  fingerprint: string
  url: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  utm_id: string
  utm_s1: string
  referrer: string
  referrer_source: string
  browser: string
  os: string
  device: string
  country: string
  country_code: string
  city: string
  state: string
  zipcode: string
  geo_zipcode: string
  form_zip_entered: string
  client_ip: string
  client_ip_hash: string
  phone_hash: string
  email_hash: string
  state_code: string
  latitude: number
  longitude: number
  geo_accuracy: number
  network_class: string
  network_asn: number
  network_org: string
  network_evidence_source: string
  network_evidence_as_of: string
  variant: string
  formtype: string
  metric_name: string
  metric_value: number
  properties: string
  trace_id: string
  created_at: string
  sdk_version: string
  sdk_capabilities: string
  event_seq: number
  batch_id: string
  retry_id: string
  client_ts: number
  integrity_json: string
}

export interface EnrichmentForRow {
  referrerSource: string
  browser: string
  os: string
  device: string
  country: string
  countryCode?: string
  city: string
  state: string
  zipcode: string
  stateCode: string
  latitude: number | null
  longitude: number | null
  accuracyRadius: number | null
  tenantWorkspaceId?: string
  landingPageId?: string
  clientIp?: string
  clientIpHash?: string
  networkClass?: string
  networkAsn?: number | null
  networkOrg?: string
  networkEvidenceSource?: string
  networkEvidenceAsOf?: string
  integrityJson?: string
}

function zipFromValue(raw: unknown): string {
  if (typeof raw === 'string' || typeof raw === 'number') {
    const digits = String(raw).replace(/\D/g, '').slice(0, 5)
    return digits.length === 5 ? digits : ''
  }
  return ''
}

function zipFromProps(props: Record<string, unknown> | undefined): string {
  const direct = zipFromValue(props?.zip ?? props?.zipCode ?? props?.zipcode)
  if (direct) return direct
  const fields = props?.fields
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    const record = fields as Record<string, unknown>
    return (
      zipFromValue(record.zip) ||
      zipFromValue(record.zipCode) ||
      zipFromValue(record.zipcode) ||
      zipFromValue(record.postal)
    )
  }
  return ''
}

export function sanitizeEventUrl(raw: string | undefined | null): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return ''
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}${url.hash}`.slice(0, 2048)
  } catch {
    return (value.split('?')[0] ?? '').slice(0, 2048)
  }
}

export function ingestBodyToEventRow(
  body: IngestEventBody,
  traceId: string,
  enrichment: EnrichmentForRow,
): EventRow {
  const forZip = materializeOpaqueProps(body.props)
  const submittedZip = zipFromProps(body.props) || zipFromProps(forZip)
  const contacts = extractContactHashesFromProps(body.props, {
    country: enrichment.country,
    stateCode: enrichment.stateCode,
  })
  const eventName = body.event_name ?? body.ev ?? ''
  const sealed =
    eventName === FI_EVENT_NAME
      ? sealFiPropsForStorage(body.props)
      : sealPropsForStorage(body.props)
  const formtype =
    body.formtype === 'zip' ||
    body.formtype === 'single' ||
    body.formtype === 'multiple' ||
    body.formtype === 'none'
      ? body.formtype
      : ''
  const propsWithFormtype = formtype
    ? { ...sealed, formtype }
    : sealed
  const clientTs =
    typeof body.ts === 'number' && Number.isFinite(body.ts) ? body.ts : 0
  const eventSeq =
    typeof body.seq === 'number' && Number.isFinite(body.seq) && body.seq >= 0
      ? Math.floor(body.seq)
      : 0
  const integrityExtra =
    enrichment.integrityJson && enrichment.integrityJson !== '{}'
      ? enrichment.integrityJson
      : '{}'

  return {
    event_id: body.event_id?.trim() ?? '',
    event_name: body.event_name ?? body.ev ?? '',
    workspace_id:
      enrichment.landingPageId?.trim() ||
      body.workspace_id ||
      body.wid ||
      '',
    tenant_workspace_id: enrichment.tenantWorkspaceId?.trim() ?? '',
    lp_public_id: body.lp_id?.trim() ?? '',
    user_id: body.uid,
    session_id: body.sid,
    fingerprint: body.fp ?? '',
    url: sanitizeEventUrl(body.url),
    utm_source: body.utm_source ?? '',
    utm_medium: body.utm_medium ?? '',
    utm_campaign: body.utm_campaign ?? '',
    utm_term: body.utm_term ?? '',
    utm_content: body.utm_content ?? '',
    utm_id: body.utm_id ?? '',
    utm_s1: body.utm_s1 ?? '',
    referrer: body.referrer ?? '',
    referrer_source: enrichment.referrerSource,
    browser: enrichment.browser,
    os: enrichment.os,
    device: enrichment.device,
    country: enrichment.country,
    country_code: enrichment.countryCode?.trim().toUpperCase() || '',
    city: enrichment.city,
    state: enrichment.state,
    zipcode: submittedZip,
    geo_zipcode: enrichment.zipcode?.trim() || '',
    form_zip_entered: submittedZip,
    client_ip: (enrichment.clientIp || '').trim().slice(0, 45),
    client_ip_hash: enrichment.clientIpHash?.trim() || '',
    phone_hash: contacts.phoneHash,
    email_hash: contacts.emailHash,
    state_code: enrichment.stateCode,
    latitude: enrichment.latitude ?? 0,
    longitude: enrichment.longitude ?? 0,
    geo_accuracy: enrichment.accuracyRadius ?? 0,
    network_class: enrichment.networkClass?.trim() || 'unavailable',
    network_asn:
      typeof enrichment.networkAsn === 'number' &&
      Number.isFinite(enrichment.networkAsn)
        ? enrichment.networkAsn
        : 0,
    network_org: enrichment.networkOrg?.trim() || '',
    network_evidence_source: enrichment.networkEvidenceSource?.trim() || '',
    network_evidence_as_of: enrichment.networkEvidenceAsOf?.trim() || '',
    variant: body.variant ?? '',
    formtype,
    metric_name: body.metric_name ?? '',
    metric_value: typeof body.metric_value === 'number' && Number.isFinite(body.metric_value)
      ? body.metric_value
      : 0,
    properties: serializeProps(propsWithFormtype),
    trace_id: traceId,
    created_at: toClickHouseDateTime64(new Date()),
    sdk_version: (body.sdk_version ?? '').trim().slice(0, 32),
    sdk_capabilities: (body.sdk_capabilities ?? '').trim().slice(0, 256),
    event_seq: eventSeq,
    batch_id: (body.batch_id ?? '').trim().slice(0, 64),
    retry_id: (body.retry_id ?? '').trim().slice(0, 64),
    client_ts: clientTs,
    integrity_json: integrityExtra,
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
