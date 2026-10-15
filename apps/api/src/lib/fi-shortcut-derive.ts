import { createHash } from 'node:crypto'
import {
  decryptJsonBlob,
  FI_EVENT_NAME,
  OPAQUE_PROP_KEY,
} from './field-blob.js'
import { detectClipboardFromFiPayload } from './fi-clipboard.js'
import type { EventRow } from '../types/event.js'

function derivedEventId(parentEventId: string, kind: 'copy' | 'paste'): string {
  const hash = createHash('sha256')
    .update(`fi-shortcut:${kind}:${parentEventId}`)
    .digest()
  const bytes = Buffer.alloc(16)
  hash.copy(bytes, 0, 0, 16)
  const b6 = bytes.readUInt8(6)
  const b8 = bytes.readUInt8(8)
  bytes.writeUInt8((b6 & 0x0f) | 0x80, 6)
  bytes.writeUInt8((b8 & 0x3f) | 0x80, 8)
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function clipboardFlagsFromFiRow(row: EventRow): {
  usedCopy: boolean
  usedPaste: boolean
} {
  if (row.event_name !== FI_EVENT_NAME) {
    return { usedCopy: false, usedPaste: false }
  }
  try {
    const props = JSON.parse(row.properties || '{}') as Record<string, unknown>
    const blob = props[OPAQUE_PROP_KEY]
    if (typeof blob !== 'string' || !blob) {
      return { usedCopy: false, usedPaste: false }
    }
    return detectClipboardFromFiPayload(decryptJsonBlob(blob))
  } catch {
    return { usedCopy: false, usedPaste: false }
  }
}

export function buildShortcutRowsFromFi(row: EventRow): EventRow[] {
  const flags = clipboardFlagsFromFiRow(row)
  if (!flags.usedCopy && !flags.usedPaste) return []

  const out: EventRow[] = []
  const kinds: Array<{ kind: 'copy' | 'paste'; name: string }> = []
  if (flags.usedCopy) {
    kinds.push({ kind: 'copy', name: 'form_shortcut_copy' })
  }
  if (flags.usedPaste) {
    kinds.push({ kind: 'paste', name: 'form_shortcut_paste' })
  }

  for (const { kind, name } of kinds) {
    const eventId = row.event_id
      ? derivedEventId(row.event_id, kind)
      : derivedEventId(`${row.workspace_id}:${row.session_id}`, kind)
    out.push({
      ...row,
      event_id: eventId,
      event_name: name,
      properties: JSON.stringify({ source: 'fi_derive', kind }),
      metric_name: '',
      metric_value: 0,
    })
  }
  return out
}
