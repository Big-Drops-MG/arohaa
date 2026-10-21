import { getItem, setItem } from "../services/storage.service"
import { getIdentity } from "./identity"

const SEQ_KEY_PREFIX = "aro_seq:"


export function nextSessionSeq(): number {
  const sid = getIdentity().sid || "unknown"
  const key = `${SEQ_KEY_PREFIX}${sid}`

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const raw = getItem(key)
    const prev = raw ? Number.parseInt(raw, 10) : 0
    const base = Number.isFinite(prev) && prev >= 0 ? prev : 0
    const next = base + 1
    setItem(key, String(next))
    const confirmed = getItem(key)
    if (confirmed === String(next)) return next
  }

  const fallback = Date.now() % 1_000_000_000
  setItem(key, String(fallback))
  return fallback > 0 ? fallback : 1
}
