import { getCookie, setCookie } from "../services/cookie.service"
import {
  getItem as getStorage,
  setItem as setStorage,
} from "../services/storage.service"
import type { Identity } from "../types"
import { generateFingerprint } from "../utils/fingerprint"
import { generateUUID } from "../utils/uuid"

const UID_KEY = "aro_uid"
const SID_KEY = "aro_sid"
const SID_TS_KEY = "aro_sid_ts"

const SESSION_WINDOW_MS = 30 * 60 * 1000

let cachedIdentity: Identity | null = null

function readUserId(): string {
  const fromStorage = getStorage(UID_KEY)
  if (fromStorage) return fromStorage

  const fromCookie = getCookie(UID_KEY)
  if (fromCookie) {
    setStorage(UID_KEY, fromCookie)
    return fromCookie
  }

  const created = generateUUID()
  setStorage(UID_KEY, created)
  setCookie(UID_KEY, created)
  return created
}

function readSessionId(now: number): string {
  const existingSid = getStorage(SID_KEY)
  const lastActivityRaw = getStorage(SID_TS_KEY)
  const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : 0

  const isFresh =
    !!existingSid &&
    Number.isFinite(lastActivity) &&
    now - lastActivity < SESSION_WINDOW_MS

  const sid = isFresh ? (existingSid as string) : generateUUID()

  setStorage(SID_KEY, sid)
  setStorage(SID_TS_KEY, String(now))
  return sid
}

export function initIdentity(): Identity {
  const now = Date.now()
  const uid = readUserId()
  const sid = readSessionId(now)
  const fp = generateFingerprint()

  cachedIdentity = { uid, sid, fp }
  return cachedIdentity
}

export function getIdentity(): Identity {
  const now = Date.now()

  if (!cachedIdentity) {
    return initIdentity()
  }

  const sid = readSessionId(now)
  if (sid !== cachedIdentity.sid) {
    cachedIdentity = { ...cachedIdentity, sid }
  } else {
    setStorage(SID_TS_KEY, String(now))
  }

  return cachedIdentity
}
