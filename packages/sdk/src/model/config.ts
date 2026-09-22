import type { SDKConfig } from "../types"
import { normalizeDeniedPath } from "../utils/utm-block"
import { getItem, setItem } from "../services/storage.service"

const DEFAULT_CONFIG: SDKConfig = {
  wid: "",
  lpId: "",
  page: "",
  variant: "",
  formtype: "single",
  apiBase: "",
  utmBlockRedirect: "",
  utmDeniedPath: "/access-denied",
  webPushProxy: "",
}

let config: SDKConfig = DEFAULT_CONFIG
let initialized = false

function parseFormType(
  formtype: string | null | undefined,
): SDKConfig["formtype"] {
  if (
    formtype === "zip" ||
    formtype === "single" ||
    formtype === "multiple" ||
    formtype === "none"
  ) {
    return formtype
  }

  return "single"
}

function resolveScriptElement(): HTMLScriptElement | null {
  const current = document.currentScript as HTMLScriptElement | null
  if (current) return current

  return (
    (document.getElementById("arohaa-sdk") as HTMLScriptElement | null) ??
    (document.querySelector(
      'script[data-wid][src*="sdk"]',
    ) as HTMLScriptElement | null)
  )
}

function variantStorageKey(wid: string, lpId: string): string {
  const scope = (lpId || wid || "default").trim() || "default"
  return `aro_variant:${scope}`
}

function resolveStickyVariant(
  fromAttr: string,
  wid: string,
  lpId: string,
): string {
  const attr = fromAttr.trim()
  const key = variantStorageKey(wid, lpId)
  const sticky = (getItem(key) ?? "").trim()
  if (sticky) return sticky.slice(0, 64)
  if (attr) {
    setItem(key, attr.slice(0, 64))
    return attr.slice(0, 64)
  }
  return ""
}

export function initializeConfig(script?: HTMLScriptElement | null): SDKConfig {
  const resolvedScript = script ?? resolveScriptElement()
  const pageFallback =
    typeof window !== "undefined" ? window.location.hostname : ""

  const wid = resolvedScript?.getAttribute("data-wid") ?? ""
  const lpId = resolvedScript?.getAttribute("data-lp-id") ?? ""
  const attrVariant =
    resolvedScript?.getAttribute("data-variant")?.trim() || ""

  config = {
    wid,
    lpId,
    page: resolvedScript?.getAttribute("data-page") ?? pageFallback,
    variant: resolveStickyVariant(attrVariant, wid, lpId),
    formtype: parseFormType(resolvedScript?.getAttribute("data-formtype")),
    apiBase: resolvedScript?.getAttribute("data-api") ?? "",
    utmBlockRedirect:
      resolvedScript?.getAttribute("data-utm-block-redirect") ?? "",
    utmDeniedPath: normalizeDeniedPath(
      resolvedScript?.getAttribute("data-utm-denied-path"),
    ),
    webPushProxy:
      resolvedScript?.getAttribute("data-web-push-proxy")?.trim() ?? "",
  }

  initialized = true
  return config
}

export function getConfig(): SDKConfig {
  if (!initialized && typeof document !== "undefined") {
    return initializeConfig()
  }

  return config
}
