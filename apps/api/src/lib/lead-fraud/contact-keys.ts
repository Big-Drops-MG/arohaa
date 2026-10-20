import {
  getClickHouseClient,
  LEAD_CONTACT_KEYS_TABLE,
} from '../../services/clickhouse.service.js'
import {
  EMAIL_NORM_VERSION,
  PHONE_NORM_VERSION,
} from './constants.js'
import { extractAllContactHashesFromProps } from './contact-hash.js'
import type { LeadSessionSignalRow } from './field-signals.js'
import { extractRawFieldMap } from './field-signals.js'
import { normalizeLeadFields, pickLeadEmail, pickLeadZip } from '../lead-fields.js'

export type LeadContactKeyRow = {
  tenant_workspace_id: string
  key_type: 'phone' | 'email'
  key_hash: string
  landing_page_id: string
  session_id: string
  event_id: string
  utm_source: string
  utm_s1: string
  utm_campaign: string
  submitted_at: string
  first_name: string
  last_name: string
  email_masked: string
  zip: string
  norm_version: string
}

function toChDateTimeFromMs(ms: number): string {
  const date = ms > 0 ? new Date(ms) : new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at <= 1) return trimmed ? '***' : ''
  return `${trimmed[0]}***${trimmed.slice(at)}`
}

export function contactKeyRowsFromSignal(
  row: LeadSessionSignalRow,
): LeadContactKeyRow[] {
  const tenant = (row.tenantWorkspaceId || '').trim()
  if (!tenant) return []
  const fields = normalizeLeadFields(extractRawFieldMap(row.props || '{}'))
  const email = pickLeadEmail(fields)
  const base = {
    tenant_workspace_id: tenant,
    landing_page_id: row.workspaceId,
    session_id: row.sessionId,
    event_id: row.eventId || '',
    utm_source: row.utmSource || '',
    utm_s1: row.utmS1 || '',
    utm_campaign: row.utmCampaign || '',
    submitted_at: toChDateTimeFromMs(row.submittedAtMs),
    first_name: (fields.first_name || '').trim(),
    last_name: (fields.last_name || '').trim(),
    email_masked: maskEmail(email),
    zip: pickLeadZip(fields),
  }

  if (!base.event_id) {
    base.event_id = `sub:${base.submitted_at}`
  }

  let props: Record<string, unknown> | undefined
  try {
    props = JSON.parse(row.props || '{}') as Record<string, unknown>
  } catch {
    props = undefined
  }
  const dual = extractAllContactHashesFromProps(props)
  const phoneHashes = new Set(
    [row.phoneHash, ...dual.phoneHashes].filter(Boolean) as string[],
  )
  const emailHashes = new Set(
    [row.emailHash, ...dual.emailHashes].filter(Boolean) as string[],
  )

  const out: LeadContactKeyRow[] = []
  for (const hash of phoneHashes) {
    out.push({
      ...base,
      key_type: 'phone',
      key_hash: hash,
      norm_version: PHONE_NORM_VERSION,
    })
  }
  for (const hash of emailHashes) {
    out.push({
      ...base,
      key_type: 'email',
      key_hash: hash,
      norm_version: EMAIL_NORM_VERSION,
    })
  }
  return out
}

export async function upsertLeadContactKeys(
  rows: LeadContactKeyRow[],
): Promise<void> {
  if (rows.length === 0) return
  const ch = getClickHouseClient()
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    await ch.insert({
      table: LEAD_CONTACT_KEYS_TABLE,
      values: rows.slice(i, i + chunkSize),
      format: 'JSONEachRow',
    })
  }
}

export async function persistContactKeysFromSignals(
  signals: LeadSessionSignalRow[],
): Promise<void> {
  const rows = signals.flatMap(contactKeyRowsFromSignal)
  await upsertLeadContactKeys(rows)
}
