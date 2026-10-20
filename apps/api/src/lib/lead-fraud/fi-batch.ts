import {
  decryptJsonBlob,
  FI_EVENT_NAME,
  OPAQUE_PROP_KEY,
} from '../field-blob.js'
import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { parseFiBehavior } from './features.js'
import type { FiLogItem } from './types.js'

type CHJson<T> = { data: T[] }

type FiRow = {
  workspace_id: string
  session_id: string
  properties: string
  created_at: string
}

function flattenFiItems(payload: unknown): FiLogItem[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return []
  }
  const p = payload as { i?: unknown; items?: unknown }
  const items = Array.isArray(p.i)
    ? p.i
    : Array.isArray(p.items)
      ? p.items
      : []
  const out: FiLogItem[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const row = item as { m?: unknown; t?: unknown; k?: unknown }
    const message = typeof row.m === 'string' ? row.m : ''
    if (!message) continue
    const offsetMs =
      typeof row.t === 'number' && Number.isFinite(row.t)
        ? Math.max(0, Math.floor(row.t))
        : 0
    const kind =
      typeof row.k === 'number' && Number.isFinite(row.k)
        ? Math.trunc(row.k)
        : null
    out.push({ offsetMs, message, kind })
  }
  return out
}

export type FiBehaviorSummary = ReturnType<typeof parseFiBehavior> & {
  fiBehaviorKnown: true
}

function sessionKey(workspaceId: string, sessionId: string): string {
  return `${workspaceId}:${sessionId}`
}


export async function loadFiBehaviorBySessions(
  sessions: Array<{ workspaceId: string; sessionId: string }>,
): Promise<Map<string, FiBehaviorSummary>> {
  const out = new Map<string, FiBehaviorSummary>()
  const unique = new Map<string, { workspaceId: string; sessionId: string }>()
  for (const s of sessions) {
    const wid = s.workspaceId.trim()
    const sid = s.sessionId.trim()
    if (!wid || !sid) continue
    unique.set(sessionKey(wid, sid), { workspaceId: wid, sessionId: sid })
  }
  if (unique.size === 0) return out

  const byWorkspace = new Map<string, string[]>()
  for (const s of unique.values()) {
    const list = byWorkspace.get(s.workspaceId) ?? []
    list.push(s.sessionId)
    byWorkspace.set(s.workspaceId, list)
  }

  const ch = getClickHouseClient()
  const itemsByKey = new Map<string, FiLogItem[]>()

  for (const [wid, sids] of byWorkspace) {
    const chunkSize = 400
    for (let i = 0; i < sids.length; i += chunkSize) {
      const chunk = sids.slice(i, i + chunkSize)
      try {
        const res = await ch.query({
          format: 'JSON',
          query_params: { wid, sids: chunk, ev: FI_EVENT_NAME },
          query: `
            SELECT
              toString(e.workspace_id) AS workspace_id,
              e.session_id AS session_id,
              e.properties AS properties,
              toString(e.created_at) AS created_at
            FROM ${CLICKHOUSE_EVENTS_TABLE} AS e
            WHERE e.workspace_id = {wid:UUID}
              AND e.session_id IN {sids:Array(String)}
              AND e.event_name = {ev:String}
            ORDER BY e.created_at ASC
            LIMIT 20000
          `,
        })
        const rows = ((await res.json()) as CHJson<FiRow>).data ?? []
        for (const row of rows) {
          const key = sessionKey(row.workspace_id, row.session_id)
          try {
            const props = JSON.parse(row.properties || '{}') as Record<
              string,
              unknown
            >
            const blob = props[OPAQUE_PROP_KEY]
            if (typeof blob !== 'string' || !blob) continue
            const decrypted = decryptJsonBlob(blob)
            const items = flattenFiItems(decrypted)
            if (items.length === 0) continue
            const prev = itemsByKey.get(key) ?? []
            prev.push(...items)
            itemsByKey.set(key, prev)
          } catch {
            /* skip */
          }
        }
      } catch (err) {
        console.error('[lead-fraud] loadFiBehaviorBySessions failed', err)
      }
    }
  }

  for (const [key, items] of itemsByKey) {
    if (items.length === 0) continue
    out.set(key, { ...parseFiBehavior(items), fiBehaviorKnown: true })
  }
  return out
}
