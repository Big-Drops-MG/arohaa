import { track } from "../core/tracker"
import { enableSdkCapability, SDK_CAPABILITY } from "../model/capabilities"

const OBS_VERSION = 1
let installed = false
let baselineFormActions: string[] = []
let reported = false

function scriptOrigins(): string[] {
  if (typeof document === "undefined") return []
  const out: string[] = []
  const scripts = document.querySelectorAll("script[src]")
  for (const el of scripts) {
    const src = el.getAttribute("src")?.trim()
    if (!src) continue
    try {
      out.push(new URL(src, location.href).origin)
    } catch {
      out.push("invalid")
    }
  }
  return [...new Set(out)].slice(0, 40)
}

function formActions(): string[] {
  if (typeof document === "undefined") return []
  const out: string[] = []
  for (const form of Array.from(document.forms)) {
    const action = (form.getAttribute("action") || "").trim() || location.href
    try {
      out.push(new URL(action, location.href).href.split("?")[0] ?? "")
    } catch {
      out.push(action.slice(0, 256))
    }
  }
  return [...new Set(out.filter(Boolean))].slice(0, 20)
}

function iframeOrigins(): string[] {
  if (typeof document === "undefined") return []
  const out: string[] = []
  for (const frame of Array.from(document.querySelectorAll("iframe[src]"))) {
    const src = frame.getAttribute("src")?.trim()
    if (!src) continue
    try {
      out.push(new URL(src, location.href).origin)
    } catch {
      out.push("invalid")
    }
  }
  return [...new Set(out)].slice(0, 20)
}

function emitSnapshot(reason: string): void {
  if (reported && reason === "init") return
  if (reason === "init") reported = true
  track("page_integrity", {
    v: OBS_VERSION,
    reason,
    script_origins: scriptOrigins(),
    form_actions: formActions(),
    iframe_origins: iframeOrigins(),
    baseline_form_actions: baselineFormActions,
    context_accessible: typeof document !== "undefined",
  })
}

export function setupPageIntegrityObservations(): void {
  if (installed || typeof document === "undefined") return
  installed = true
  enableSdkCapability(SDK_CAPABILITY.pageIntegrity)
  baselineFormActions = formActions()
  emitSnapshot("init")

  const observer = new MutationObserver((mutations) => {
    let scripts = false
    let frames = false
    let forms = false
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof Element)) continue
        if (node.tagName === "SCRIPT" || node.querySelector?.("script")) {
          scripts = true
        }
        if (node.tagName === "IFRAME" || node.querySelector?.("iframe")) {
          frames = true
        }
        if (node.tagName === "FORM" || node.querySelector?.("form")) {
          forms = true
        }
      }
      if (m.type === "attributes" && m.target instanceof HTMLFormElement) {
        forms = true
      }
    }
    if (scripts) emitSnapshot("script_added")
    if (frames) emitSnapshot("iframe_added")
    if (forms) emitSnapshot("form_changed")
  })

  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["action", "src"],
    })
  } catch {
    track("page_integrity", {
      v: OBS_VERSION,
      reason: "observer_unavailable",
      context_accessible: false,
    })
  }
}
