const CHANGED_RE =
  /^changed value to "([\s\S]*)" in \[([^\]]+)\]$/i
const SELECTED_RE = /^selected "([\s\S]*)" in \[([^\]]+)\]$/i
const TYPED_RE = /^typed '([\s\S]*)' in \[([^\]]+)\]$/i
const MASKED_PHONE_RE = /^\*+$/

function applyField(
  into: Record<string, string>,
  field: string,
  value: string,
): void {
  const key = field.trim()
  const trimmed = value.trim()
  if (!key || !trimmed) return
  if (MASKED_PHONE_RE.test(trimmed)) return
  if (trimmed === 'digit' || trimmed === 'letter' || trimmed === 'symbol') return
  into[key] = trimmed.slice(0, 500)
}

/** Pull lead field values from Event Log (`_fi`) messages. */
export function extractFieldsFromFiMessage(
  message: string,
  into: Record<string, string>,
  typedBuffers: Map<string, string>,
): void {
  const text = message.trim()
  if (!text) return

  let match = text.match(CHANGED_RE)
  if (match) {
    const value = match[1] ?? ''
    const field = match[2] ?? ''
    applyField(into, field, value)
    typedBuffers.delete(field.trim())
    return
  }

  match = text.match(SELECTED_RE)
  if (match) {
    const value = match[1] ?? ''
    const field = match[2] ?? ''
    applyField(into, field, value)
    typedBuffers.delete(field.trim())
    return
  }

  match = text.match(TYPED_RE)
  if (match) {
    const chunk = match[1] ?? ''
    const field = (match[2] ?? '').trim()
    if (
      !field ||
      !chunk ||
      chunk === 'digit' ||
      chunk === 'letter' ||
      chunk === 'symbol' ||
      chunk === 'space'
    ) {
      if (chunk === 'space' && field) {
        typedBuffers.set(field, `${typedBuffers.get(field) ?? ''} `)
      }
      return
    }
    typedBuffers.set(field, `${typedBuffers.get(field) ?? ''}${chunk}`)
  }
}

export function extractFieldsFromFiPayload(
  payload: unknown,
): Record<string, string> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }
  const items = Array.isArray((payload as { i?: unknown }).i)
    ? ((payload as { i: unknown[] }).i)
    : Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : []

  const into: Record<string, string> = {}
  const typedBuffers = new Map<string, string>()
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const message = (item as { m?: unknown }).m
    if (typeof message !== 'string' || !message) continue
    extractFieldsFromFiMessage(message, into, typedBuffers)
  }
  for (const [field, value] of typedBuffers) {
    if (!into[field]) applyField(into, field, value)
  }
  return into
}

export function mergeFieldMaps(
  ...maps: Array<Record<string, string> | undefined>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const map of maps) {
    if (!map) continue
    for (const [k, v] of Object.entries(map)) {
      const key = k.trim()
      const value = String(v ?? '').trim()
      if (!key || !value) continue
      out[key] = value
    }
  }
  return out
}
