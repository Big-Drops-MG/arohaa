import { getCookie, setCookie } from "../services/cookie.service"
import {
  getItem as getStorage,
  setItem as setStorage,
} from "../services/storage.service"
import type { Identity } from "../types"
import { generateFingerprint } from "../utils/fingerprint"
import { generateUUID } from "../utils/uuid"
import { getRemoteRedirectHostname } from "../core/sdk-config"

const UID_KEY = "aro_uid"
const SID_KEY = "aro_sid"
const SID_TS_KEY = "aro_sid_ts"

const SESSION_WINDOW_MS = 30 * 60 * 1000

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let cachedIdentity: Identity | null = null

function isIdentityId(value: string): boolean {
  return UUID_RE.test(value)
}

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
  seedIdentityFromQuery()
  const now = Date.now()
  const uid = readUserId()
  const sid = readSessionId(now)
  const fp = generateFingerprint()

  cachedIdentity = { uid, sid, fp }
  return cachedIdentity
}

function seedIdentityFromQuery(): void {
  if (typeof window === "undefined") return
  try {
    const redirectHost = getRemoteRedirectHostname()?.trim().toLowerCase()
    const host = window.location.hostname.toLowerCase()
    if (!redirectHost || host !== redirectHost) {
      stripIdentityQueryParams()
      return
    }

    const params = new URLSearchParams(window.location.search)
    const uid = params.get("aro_uid")?.trim() ?? ""
    const sid = params.get("aro_sid")?.trim() ?? ""
    if (!isIdentityId(uid) || !isIdentityId(sid)) {
      stripIdentityQueryParams()
      return
    }

    setStorage(UID_KEY, uid)
    setCookie(UID_KEY, uid)
    setStorage(SID_KEY, sid)
    setStorage(SID_TS_KEY, String(Date.now()))
    stripIdentityQueryParams()
  } catch {
    /* ignore */
  }
}

function stripIdentityQueryParams(): void {
  if (typeof window === "undefined" || typeof history === "undefined") return
  try {
    const url = new URL(window.location.href)
    let changed = false
    for (const key of ["aro_uid", "aro_sid"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    }
    if (!changed) return
    const next = `${url.pathname}${url.search}${url.hash}`
    history.replaceState(history.state, "", next)
  } catch {
    /* ignore */
  }
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

export function __resetIdentityForTests(): void {
  cachedIdentity = null
}
