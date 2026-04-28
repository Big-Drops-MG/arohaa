import type { SDKConfig } from "../types"

export function getConfig(): SDKConfig {
  const script = document.currentScript as HTMLScriptElement | null
  const formtype = script?.getAttribute("data-formtype")

  return {
    wid: script?.getAttribute("data-wid") ?? "",
    page: script?.getAttribute("data-page") ?? window.location.hostname,
    variant: script?.getAttribute("data-variant") ?? "A",
    formtype:
      formtype === "zip" || formtype === "single" || formtype === "multiple"
        ? formtype
        : "single",
  }
}
