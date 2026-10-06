import { getClickHouseClient } from './clickhouse.service.js'
import {
  decryptFieldBlob,
  decryptJsonBlob,
  FI_EVENT_NAME,
  OPAQUE_PROP_KEY,
} from '../lib/field-blob.js'
import {
  normalizeLeadFields,
  pickLeadEmail,
} from '../lib/lead-fields.js'
import { ensureSessionFraudAssessment } from '../lib/lead-fraud/index.js'
import type { LeadFraudAssessment } from '../lib/lead-fraud/types.js'

export type InteractionLogEntry = {
  at: string
  offsetMs: number
  message: string
  kind: number | null
}

export type InteractionLogResult = {
  sessionId: string
  startedAt: string | null
  formId: string | null
  firstName: string
  lastName: string
  email: string
  fraud: LeadFraudAssessment | null
  entries: InteractionLogEntry[]
}

type FiItem = {
  t?: unknown
  ts?: unknown
  k?: unknown
  m?: unknown
}

type FiPayload = {
  v?: unknown
  s?: unknown
  f?: unknown
  i?: unknown
}

function parseProps(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* ignore */
  }
  return {}
}

function toIso(ms: number): string {
  try {
    return new Date(ms).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}

function parseKind(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return null
}

function flattenPayload(
  payload: FiPayload,
  eventCreatedAt: string,
): {
  startedAtMs: number | null
  formId: string | null
  entries: InteractionLogEntry[]
} {
  const items = Array.isArray(payload.i) ? (payload.i as FiItem[]) : []
  const startedAtMs =
    typeof payload.s === 'number' && Number.isFinite(payload.s)
      ? payload.s
      : null
  const formId =
    typeof payload.f === 'string' && payload.f.trim()
      ? payload.f.trim().slice(0, 200)
      : null

  const entries: InteractionLogEntry[] = []
  for (const item of items) {
    const message = typeof item.m === 'string' ? item.m : ''
    if (!message) continue
    const offsetMs =
      typeof item.t === 'number' && Number.isFinite(item.t)
        ? Math.max(0, Math.floor(item.t))
        : 0
    const tsMs =
      typeof item.ts === 'number' && Number.isFinite(item.ts)
        ? item.ts
        : startedAtMs != null
          ? startedAtMs + offsetMs
          : Date.parse(eventCreatedAt.replace(' ', 'T') + 'Z')
    entries.push({
      at: Number.isFinite(tsMs) ? toIso(tsMs) : eventCreatedAt,
      offsetMs,
      message,
      kind: parseKind(item.k),
    })
  }
  return { startedAtMs, formId, entries }
}

function extractLeadIdentity(properties: string): {
  firstName: string
  lastName: string
  email: string
} {
  try {
    const props = parseProps(properties)
    let raw: Record<string, string> = {}
    const blob = props._k
    if (typeof blob === 'string' && blob.length > 0) {
      const decrypted = decryptFieldBlob(blob)
      if (decrypted) raw = decrypted
    } else if (
      props.fields &&
      typeof props.fields === 'object' &&
      !Array.isArray(props.fields)
    ) {
      for (const [k, v] of Object.entries(
        props.fields as Record<string, unknown>,
      )) {
        if (
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean'
        ) {
          raw[k] = String(v)
        }
      }
    }
    const fields = normalizeLeadFields(raw)
    return {
      firstName: (fields.first_name || '').trim(),
      lastName: (fields.last_name || '').trim(),
      email: pickLeadEmail(fields),
    }
  } catch {
    return { firstName: '', lastName: '', email: '' }
  }
}

export async function getSessionInteractionLog({
  workspaceId,
  sessionId,
}: {
  workspaceId: string
  sessionId: string
}): Promise<InteractionLogResult> {
  const sid = sessionId.trim()
  if (!sid) {
    return {
      sessionId: '',
      startedAt: null,
      formId: null,
      firstName: '',
      lastName: '',
      email: '',
      fraud: null,
      entries: [],
    }
  }

  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId, sid, ev: FI_EVENT_NAME },
    query: `
      SELECT
        properties,
        toString(created_at) AS created_at
      FROM events_raw
      WHERE workspace_id = {wid:String}
        AND session_id = {sid:String}
        AND event_name = {ev:String}
      ORDER BY created_at ASC
      LIMIT 500
    `,
  })

  const rows = (
    (await res.json()) as {
      data: Array<{ properties: string; created_at: string }>
    }
  ).data

  const all: InteractionLogEntry[] = []
  let startedAtMs: number | null = null
  let formId: string | null = null

  for (const row of rows) {
    const props = parseProps(row.properties)
    const blob = props[OPAQUE_PROP_KEY]
    if (typeof blob !== 'string' || !blob) continue
    const decrypted = decryptJsonBlob(blob)
    if (!decrypted || typeof decrypted !== 'object' || Array.isArray(decrypted)) {
      continue
    }
    const flattened = flattenPayload(decrypted as FiPayload, row.created_at)
    if (startedAtMs == null && flattened.startedAtMs != null) {
      startedAtMs = flattened.startedAtMs
    }
    if (!formId && flattened.formId) formId = flattened.formId
    all.push(...flattened.entries)
  }

  if (!formId) {
    for (const entry of all) {
      const match = entry.message.match(
        /(?:form started|form submitted|form completed)\s*\(([^)]+)\)/i,
      )
      if (match?.[1]?.trim()) {
        formId = match[1].trim().slice(0, 200)
        break
      }
    }
  }

  if (!formId) {
    const formEventRes = await ch.query({
      format: 'JSON',
      query_params: { wid: workspaceId, sid },
      query: `
        SELECT properties
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND session_id = {sid:String}
          AND event_name IN ('form_start', 'form_submit', 'form_success')
        ORDER BY created_at ASC
        LIMIT 20
      `,
    })
    const formRows =
      (
        (await formEventRes.json()) as {
          data: Array<{ properties: string }>
        }
      ).data ?? []
    for (const row of formRows) {
      const props = parseProps(row.properties)
      const raw = props.formId
      if (typeof raw === 'string' && raw.trim()) {
        formId = raw.trim().slice(0, 200)
        break
      }
    }
  }

  all.sort((a, b) => {
    if (a.offsetMs !== b.offsetMs) return a.offsetMs - b.offsetMs
    return a.at.localeCompare(b.at)
  })

  const leadPropsRes = await ch.query({
    format: 'JSON',
    query_params: { wid: workspaceId, sid },
    query: `
      SELECT argMax(properties, (length(properties), created_at)) AS props
      FROM events_raw
      WHERE workspace_id = {wid:UUID}
        AND session_id = {sid:String}
        AND (
          positionCaseInsensitive(properties, '"fields"') > 0
          OR positionCaseInsensitive(properties, '"_k"') > 0
        )
    `,
  })
  const leadProps =
    (
      (await leadPropsRes.json()) as { data: Array<{ props: string }> }
    ).data?.[0]?.props ?? '{}'
  const identity = extractLeadIdentity(leadProps)

  let fraud: LeadFraudAssessment | null = null
  try {
    fraud = await ensureSessionFraudAssessment({
      workspaceId,
      sessionId: sid,
    })
  } catch {
    fraud = null
  }

  return {
    sessionId: sid,
    startedAt: startedAtMs != null ? toIso(startedAtMs) : null,
    formId,
    firstName: identity.firstName,
    lastName: identity.lastName,
    email: identity.email,
    fraud,
    entries: all,
  }
}
