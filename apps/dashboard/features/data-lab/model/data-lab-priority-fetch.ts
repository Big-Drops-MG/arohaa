import type { DataExportDashboardData } from "@/features/data-export/model/data-export"

const CACHE_TTL_MS = 30_000
const MAX_CACHE_ENTRIES = 12
const RETRY_DELAYS_MS = [120, 320] as const
const REQUEST_TIMEOUT_MS = 15_000

type CacheEntry = {
  data: DataExportDashboardData
  expiresAt: number
}

const responseCache = new Map<string, CacheEntry>()

export function cacheDataLabResponse(
  key: string,
  data: DataExportDashboardData
): void {
  responseCache.delete(key)
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value
    if (!oldestKey) break
    responseCache.delete(oldestKey)
  }
}

function readCachedResponse(key: string): DataExportDashboardData | null {
  const cached = responseCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key)
    return null
  }
  responseCache.delete(key)
  responseCache.set(key, cached)
  return cached.data
}

function abortableDelay(
  milliseconds: number,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

async function fetchAttempt(
  path: string,
  signal: AbortSignal
): Promise<Response> {
  const timeoutController = new AbortController()
  const timeout = window.setTimeout(
    () => timeoutController.abort(),
    REQUEST_TIMEOUT_MS
  )
  const abort = () => timeoutController.abort()
  signal.addEventListener("abort", abort, { once: true })

  try {
    return await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      signal: timeoutController.signal,
      priority: "high",
    } as RequestInit & { priority: "high" })
  } finally {
    window.clearTimeout(timeout)
    signal.removeEventListener("abort", abort)
  }
}

export async function fetchDataLabWithPriority(
  path: string,
  signal: AbortSignal
): Promise<DataExportDashboardData> {
  const cached = readCachedResponse(path)
  if (cached) return cached

  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError")

    try {
      const response = await fetchAttempt(path, signal)
      if (response.ok) {
        const data = (await response.json()) as DataExportDashboardData
        cacheDataLabResponse(path, data)
        return data
      }
      const error = new Error(`Failed to load Data Lab: ${response.status}`)
      if (!shouldRetry(response.status)) throw error
      lastError = error
    } catch (error) {
      if (signal.aborted) throw error
      lastError = error
    }

    const delay = RETRY_DELAYS_MS[attempt]
    if (delay != null) await abortableDelay(delay, signal)
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load Data Lab")
}
