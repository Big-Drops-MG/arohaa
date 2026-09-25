import { getClickHouseClient } from './clickhouse.service.js'
import {
  decryptJsonBlob,
  FI_EVENT_NAME,
  OPAQUE_PROP_KEY,
} from '../lib/field-blob.js'

export type InteractionLogEntry = {
  at: string
  offsetMs: number
  message: string
}

export type InteractionLogResult = {
  sessionId: string
  startedAt: string | null
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

function flattenPayload(
  payload: FiPayload,
  eventCreatedAt: string,
): { startedAtMs: number | null; entries: InteractionLogEntry[] } {
  const items = Array.isArray(payload.i) ? (payload.i as FiItem[]) : []
  const startedAtMs =
    typeof payload.s === 'number' && Number.isFinite(payload.s)
      ? payload.s
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
    })
  }
  return { startedAtMs, entries }
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
    return { sessionId: '', startedAt: null, entries: [] }
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

  for (const row of rows) {
    const props = parseProps(row.properties)
    const blob = props[OPAQUE_PROP_KEY]
    if (typeof blob !== 'string' || !blob) continue
    const decrypted = decryptJsonBlob(blob)
    if (!decrypted || typeof decrypted !== 'object' || Array.isArray(decrypted)) {
      continue
    }
    const { startedAtMs: s, entries } = flattenPayload(
      decrypted as FiPayload,
      row.created_at,
    )
    if (startedAtMs == null && s != null) startedAtMs = s
    all.push(...entries)
  }

  all.sort((a, b) => {
    if (a.offsetMs !== b.offsetMs) return a.offsetMs - b.offsetMs
    return a.at.localeCompare(b.at)
  })

  return {
    sessionId: sid,
    startedAt: startedAtMs != null ? toIso(startedAtMs) : null,
    entries: all,
  }
}
