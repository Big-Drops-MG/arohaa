import { getConfig } from "../model/config"
import { track } from "../core/tracker"

export type SdkServiceConfig = {
  id: string
  label: string
  href?: string
}

function normalizeHref(href: string): string {
  try {
    const u = new URL(href, window.location.href)
    u.hash = ""
    return u.href.replace(/\/$/, "")
  } catch {
    return href.trim().replace(/\/$/, "")
  }
}

function parseServicesFromScript(): SdkServiceConfig[] {
  const script =
    (document.getElementById("arohaa-sdk") as HTMLScriptElement | null) ??
    (document.querySelector(
      'script[data-wid][src*="sdk"]',
    ) as HTMLScriptElement | null)

  const raw = script?.getAttribute("data-services")
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: SdkServiceConfig[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const id = typeof row.id === "string" ? row.id.trim() : ""
      const label = typeof row.label === "string" ? row.label.trim() : ""
      if (!id || !label) continue
      const href =
        typeof row.href === "string" && row.href.trim()
          ? row.href.trim()
          : undefined
      out.push({ id, label, href })
    }
    return out
  } catch {
    return []
  }
}

function matchServiceByHref(
  href: string,
  services: SdkServiceConfig[],
): SdkServiceConfig | null {
  const normalized = normalizeHref(href)
  for (const service of services) {
    if (!service.href) continue
    if (normalizeHref(service.href) === normalized) return service
  }
  return null
}

function resolveServiceFromTarget(
  target: HTMLElement,
  services: SdkServiceConfig[],
): {
  id: string
  label: string
  href?: string
  targetLpId?: string
} | null {
  const marked = target.closest(
    "[data-arohaa-service]",
  ) as HTMLElement | null
  if (marked) {
    const id = marked.getAttribute("data-arohaa-service")?.trim()
    if (id) {
      const configured = services.find((s) => s.id === id)
      const label =
        marked.getAttribute("data-arohaa-service-label")?.trim() ||
        configured?.label ||
        id
      const href =
        (marked instanceof HTMLAnchorElement
          ? marked.href
          : marked.getAttribute("href")) ||
        configured?.href ||
        undefined
      const targetLpId =
        marked.getAttribute("data-arohaa-target-lp")?.trim() || undefined
      return { id, label, href, targetLpId }
    }
  }

  const anchor = target.closest("a") as HTMLAnchorElement | null
  if (anchor?.href) {
    const matched = matchServiceByHref(anchor.href, services)
    if (matched) {
      return {
        id: matched.id,
        label: matched.label,
        href: anchor.href,
      }
    }
  }

  return null
}

/**
 * On hub pages (formtype=none), track clicks on configured services/verticals.
 * Prefer markup: data-arohaa-service="auto-insurance".
 * Falls back to matching configured service hrefs from data-services.
 */
export function setupServiceClickTracking(): void {
  if (getConfig().formtype !== "none") return

  const services = parseServicesFromScript()
  const fired = new WeakSet<EventTarget>()

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return

      const service = resolveServiceFromTarget(target, services)
      if (!service) return

      const keyEl =
        target.closest("[data-arohaa-service]") ||
        target.closest("a") ||
        target
      if (keyEl && fired.has(keyEl)) return
      if (keyEl) fired.add(keyEl)

      track("service_click", {
        service_id: service.id,
        service_label: service.label,
        href: service.href,
        target_lp_id: service.targetLpId,
      })
    },
    true,
  )
}
