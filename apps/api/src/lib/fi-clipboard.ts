export type FiClipboardFlags = {
  usedCopy: boolean
  usedPaste: boolean
}

export function detectClipboardFromFiMessage(message: string): FiClipboardFlags {
  const lower = message.toLowerCase()
  const usedPaste =
    lower.includes("pressed 'control+v'") ||
    lower.includes("pressed 'meta+v'") ||
    lower.includes("pressed 'control+shift+v'") ||
    lower.includes("pressed 'meta+shift+v'") ||
    lower.includes("pressed 'shift+insert'") ||
    lower.startsWith('pasted') ||
    lower.includes('pasted in')
  const usedCopy =
    lower.includes("pressed 'control+c'") ||
    lower.includes("pressed 'meta+c'") ||
    lower.startsWith('copied') ||
    lower.includes('copied in')
  return { usedCopy, usedPaste }
}

export function detectClipboardFromFiPayload(
  payload: unknown,
): FiClipboardFlags {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { usedCopy: false, usedPaste: false }
  }
  const items = Array.isArray((payload as { i?: unknown }).i)
    ? ((payload as { i: unknown[] }).i)
    : Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : []
  let usedCopy = false
  let usedPaste = false
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const message = (item as { m?: unknown }).m
    if (typeof message !== 'string' || !message) continue
    const hit = detectClipboardFromFiMessage(message)
    usedCopy = usedCopy || hit.usedCopy
    usedPaste = usedPaste || hit.usedPaste
    if (usedCopy && usedPaste) break
  }
  return { usedCopy, usedPaste }
}
