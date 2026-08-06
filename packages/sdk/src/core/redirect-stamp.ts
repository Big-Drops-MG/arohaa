import { getConfig } from "../model/config"
import {
  getRemoteRedirectHostname,
  getRemoteRedirectPageUrl,
} from "../core/sdk-config"

const STAMPED = new WeakSet<HTMLAnchorElement>()

function currentIdentityParams(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const uid = localStorage.getItem("aro_uid")
    const sid = localStorage.getItem("aro_sid")
    if (uid) out.aro_uid = uid
    if (sid) out.aro_sid = sid
  } catch {
    /* ignore */
  }
  const { lpId } = getConfig()
  if (lpId) out.lp = lpId
  return out
}

function hostMatchesRedirect(url: URL, redirectHost: string): boolean {
  return url.hostname.toLowerCase() === redirectHost.toLowerCase()
}

function stampUrl(href: string, redirectHost: string): string {
  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return href
  }
  if (!hostMatchesRedirect(url, redirectHost)) return href
  const params = currentIdentityParams()
  for (const [k, v] of Object.entries(params)) {
    if (!url.searchParams.has(k)) url.searchParams.set(k, v)
  }
  return url.toString()
}

export function setupRedirectLinkStamping(): void {
  if (typeof document === "undefined") return
  const host =
    getRemoteRedirectHostname() ||
    (() => {
      const page = getRemoteRedirectPageUrl()
      if (!page) return ""
      try {
        return new URL(page).hostname
      } catch {
        return ""
      }
    })()
  if (!host) return

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a")
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return
      if (STAMPED.has(anchor)) return
      const next = stampUrl(anchor.href, host)
      if (next !== anchor.href) {
        anchor.href = next
        STAMPED.add(anchor)
      }
    },
    true,
  )
}
