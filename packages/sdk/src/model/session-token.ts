import { getConfig } from "./config"
import { getIdentity } from "./identity"
import { getItem, setItem } from "../services/storage.service"

const TOKEN_KEY_PREFIX = "aro_st:"
const FETCH_TIMEOUT_MS = 2_500
const RENEW_BEFORE_MS = 60_000

type CachedToken = {
  token: string
  expiresAt: number
  wid: string
  lpId: string
  sid: string
}

let memoryToken: CachedToken | null = null
let inflight: Promise<string | null> | null = null
let renewTimer: ReturnType<typeof setTimeout> | null = null
let storageListenerAttached = false

function storageKey(sid: string): string {
  return `${TOKEN_KEY_PREFIX}${sid}`
}

function attachCrossTabListener(): void {
  if (storageListenerAttached) return
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return
  }
  storageListenerAttached = true
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(TOKEN_KEY_PREFIX)) return
    if (!event.newValue) {
      if (memoryToken && storageKey(memoryToken.sid) === event.key) {
        memoryToken = null
      }
      return
    }
    try {
      const parsed = JSON.parse(event.newValue) as CachedToken
      if (
        parsed?.token &&
        typeof parsed.expiresAt === "number" &&
        parsed.expiresAt > Date.now() + 5_000
      ) {
        memoryToken = parsed
        scheduleRenewal(parsed)
      }
    } catch {
      /* ignore */
    }
  })
}

attachCrossTabListener()

function readCached(sid: string): CachedToken | null {
  if (
    memoryToken &&
    memoryToken.sid === sid &&
    memoryToken.expiresAt > Date.now() + 5_000
  ) {
    return memoryToken
  }
  try {
    const raw = getItem(storageKey(sid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedToken
    if (
      !parsed?.token ||
      typeof parsed.expiresAt !== "number" ||
      parsed.sid !== sid ||
      parsed.expiresAt <= Date.now() + 5_000
    ) {
      return null
    }
    memoryToken = parsed
    return parsed
  } catch {
    return null
  }
}

function writeCached(token: CachedToken): void {
  memoryToken = token
  try {
    setItem(storageKey(token.sid), JSON.stringify(token))
  } catch {
    /* ignore */
  }
  scheduleRenewal(token)
}

function scheduleRenewal(token: CachedToken): void {
  if (renewTimer) {
    clearTimeout(renewTimer)
    renewTimer = null
  }
  const delay = Math.max(5_000, token.expiresAt - Date.now() - RENEW_BEFORE_MS)
  renewTimer = setTimeout(() => {
    void fetchSessionToken({ force: true })
  }, delay)
  if (typeof renewTimer === "object" && "unref" in renewTimer) {
    try {
      renewTimer.unref()
    } catch {
      /* ignore */
    }
  }
}

export function getSessionTokenSync(): string {
  const sid = getIdentity().sid
  const cached = readCached(sid)
  return cached?.token ?? ""
}

async function fetchSessionToken(opts?: {
  force?: boolean
}): Promise<string | null> {
  const config = getConfig()
  const identity = getIdentity()
  if (!config.apiBase || !config.wid || !identity.sid) return null

  if (!opts?.force) {
    const cached = readCached(identity.sid)
    if (
      cached &&
      cached.wid === config.wid &&
      cached.lpId === (config.lpId || "") &&
      cached.expiresAt > Date.now() + 5_000
    ) {
      return cached.token
    }
  }

  if (inflight) return inflight

  inflight = (async () => {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null
    const timer =
      controller != null
        ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        : null
    try {
      const res = await fetch(`${config.apiBase}/v1/session-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wid: config.wid,
          lp_id: config.lpId || undefined,
          sid: identity.sid,
          uid: identity.uid,
        }),
        keepalive: true,
        signal: controller?.signal,
      })
      if (!res.ok) return null
      const data = (await res.json()) as {
        token?: string
        expires_at?: number
      }
      const token = typeof data.token === "string" ? data.token.trim() : ""
      const expiresAt =
        typeof data.expires_at === "number" ? data.expires_at : 0
      if (!token || !expiresAt) return null
      writeCached({
        token,
        expiresAt,
        wid: config.wid,
        lpId: config.lpId || "",
        sid: identity.sid,
      })
      return token
    } catch {
      return null
    } finally {
      if (timer) clearTimeout(timer)
      inflight = null
    }
  })()

  return inflight
}

export function startSessionTokenRefresh(): void {
  void fetchSessionToken()
}

export async function ensureSessionToken(): Promise<string | null> {
  return fetchSessionToken()
}

export async function stampSessionToken<
  T extends { sid: string; session_token?: string },
>(payload: T): Promise<T> {
  if (payload.session_token) return payload
  if (payload.sid !== getIdentity().sid) return payload
  const hidden =
    typeof document !== "undefined" && document.visibilityState === "hidden"
  const token = hidden
    ? getSessionTokenSync()
    : (await fetchSessionToken()) ?? getSessionTokenSync()
  if (token) payload.session_token = token
  return payload
}
