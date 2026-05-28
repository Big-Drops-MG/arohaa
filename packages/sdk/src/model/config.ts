import type { SDKConfig } from "../types"

const DEFAULT_CONFIG: SDKConfig = {
  wid: "",
  lpId: "",
  page: "",
  variant: "A",
  formtype: "single",
  apiBase: "",
}

let config: SDKConfig = DEFAULT_CONFIG
let initialized = false

function parseFormType(
  formtype: string | null | undefined,
): SDKConfig["formtype"] {
  if (formtype === "zip" || formtype === "single" || formtype === "multiple") {
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

export function initializeConfig(script?: HTMLScriptElement | null): SDKConfig {
  const resolvedScript = script ?? resolveScriptElement()
  const pageFallback =
    typeof window !== "undefined" ? window.location.hostname : ""

  config = {
    wid: resolvedScript?.getAttribute("data-wid") ?? "",
    lpId: resolvedScript?.getAttribute("data-lp-id") ?? "",
    page: resolvedScript?.getAttribute("data-page") ?? pageFallback,
    variant: resolvedScript?.getAttribute("data-variant") ?? "A",
    formtype: parseFormType(resolvedScript?.getAttribute("data-formtype")),
    apiBase: resolvedScript?.getAttribute("data-api") ?? "",
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
