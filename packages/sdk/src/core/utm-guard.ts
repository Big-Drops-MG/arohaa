import type { SDKConfig } from "../types"
import { getAttributionData } from "../utils/url"
import {
  DEFAULT_UTM_DENIED_PATH,
  emptyBlockedUtmSets,
  isAccessDeniedPath,
  isUtmBlocked,
  normalizeDeniedPath,
  toBlockedUtmSets,
  type BlockedUtmLists,
  type BlockedUtmSets,
} from "../utils/utm-block"

const RULES_CACHE_MS = 60_000
const RULES_CACHE_PREFIX = "aro_utm_blk_"

export type UtmGuardResult = "allow" | "redirected" | "denied-only"

let navigationGuardInstalled = false
let activeBlockedSets: BlockedUtmSets | null = null
let activeDeniedPath = DEFAULT_UTM_DENIED_PATH

function rulesCacheKey(wid: string): string {
  return `${RULES_CACHE_PREFIX}${wid}`
}

function readCachedRules(wid: string): BlockedUtmLists | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(rulesCacheKey(wid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      exp: number
      data: BlockedUtmLists
    }
    if (!parsed?.data || parsed.exp <= Date.now()) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCachedRules(wid: string, data: BlockedUtmLists): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(
      rulesCacheKey(wid),
      JSON.stringify({ exp: Date.now() + RULES_CACHE_MS, data }),
    )
  } catch {
    // Ignore quota errors.
  }
}

async function fetchBlockedRules(
  apiBase: string,
  wid: string,
): Promise<BlockedUtmSets> {
  const cached = readCachedRules(wid)
  if (cached) return toBlockedUtmSets(cached)

  const base = apiBase.replace(/\/$/, "")
  const url = `${base}/v1/utm-blocked?wid=${encodeURIComponent(wid)}`

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    })
    if (!response.ok) return emptyBlockedUtmSets()
    const data = (await response.json()) as BlockedUtmLists
    const lists: BlockedUtmLists = {
      utm_source: Array.isArray(data.utm_source) ? data.utm_source : [],
      utm_s1: Array.isArray(data.utm_s1) ? data.utm_s1 : [],
    }
    writeCachedRules(wid, lists)
    return toBlockedUtmSets(lists)
  } catch {
    return emptyBlockedUtmSets()
  }
}

function redirectToDeniedPath(deniedPath: string): void {
  if (typeof window === "undefined") return
  const target = normalizeDeniedPath(deniedPath)
  if (window.location.pathname === target) return
  window.location.replace(target)
}

function shouldRedirectNow(deniedPath: string): boolean {
  if (typeof window === "undefined") return false
  return !isAccessDeniedPath(window.location.pathname, deniedPath)
}

function attributionIsBlocked(sets: BlockedUtmSets): boolean {
  const attribution = getAttributionData()
  return isUtmBlocked(sets, attribution.utm_source, attribution.utm_s1)
}

function installNavigationGuard(sets: BlockedUtmSets, deniedPath: string): void {
  if (typeof window === "undefined" || navigationGuardInstalled) return
  navigationGuardInstalled = true
  activeBlockedSets = sets
  activeDeniedPath = deniedPath

  const enforce = (): void => {
    const blockedSets = activeBlockedSets
    if (!blockedSets || !attributionIsBlocked(blockedSets)) return
    if (!shouldRedirectNow(activeDeniedPath)) return
    redirectToDeniedPath(activeDeniedPath)
  }

  window.addEventListener("popstate", enforce)

  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (...args) => {
    originalPushState(...args)
    enforce()
  }

  history.replaceState = (...args) => {
    originalReplaceState(...args)
    enforce()
  }
}

export async function runUtmGuard(config: SDKConfig): Promise<UtmGuardResult> {
  if (typeof window === "undefined") return "allow"

  const deniedPath = normalizeDeniedPath(config.utmDeniedPath)

  const blockedSets = await fetchBlockedRules(config.apiBase, config.wid)
  const blocked = attributionIsBlocked(blockedSets)

  if (!blocked) return "allow"

  installNavigationGuard(blockedSets, deniedPath)

  if (!shouldRedirectNow(deniedPath)) {
    return "denied-only"
  }

  redirectToDeniedPath(deniedPath)
  return "redirected"
}
