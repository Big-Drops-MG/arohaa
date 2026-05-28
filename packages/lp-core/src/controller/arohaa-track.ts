type ArohaaCallable = ((event: string, props?: Record<string, unknown>) => void) & {
  track?: (event: string, props?: Record<string, unknown>) => void
  q?: unknown[][]
}

const UID_KEY = "aro_uid"
const SID_KEY = "aro_sid"

function getScriptEl(): HTMLScriptElement | null {
  if (typeof document === "undefined") return null
  return (
    document.getElementById("arohaa-sdk") ??
    document.querySelector('script[data-wid][data-api]')
  ) as HTMLScriptElement | null
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16)
  }
  return Math.random().toString(36).slice(2, 18)
}

function beaconIngest(event: string, props?: Record<string, unknown>): boolean {
  const script = getScriptEl()
  const wid = script?.getAttribute("data-wid")?.trim()
  const apiBase = script?.getAttribute("data-api")?.trim()
  if (!wid || !apiBase || typeof navigator === "undefined") return false

  const uid = readStorage(UID_KEY) ?? randomId()
  const sid = readStorage(SID_KEY) ?? randomId()
  const lpId = script?.getAttribute("data-lp-id")?.trim()
  const formtype = script?.getAttribute("data-formtype")?.trim()

  const payload: Record<string, unknown> = {
    ev: event,
    wid,
    uid,
    sid,
    ts: Date.now(),
    url: typeof window !== "undefined" ? window.location.href : "",
    page: script?.getAttribute("data-page")?.trim() || "localhost",
    props: props ?? {},
  }
  if (lpId) payload.lp_id = lpId
  if (formtype === "zip" || formtype === "single" || formtype === "multiple") {
    payload.formtype = formtype
  }

  const url = `${apiBase.replace(/\/$/, "")}/v1/ingest`
  const body = JSON.stringify(payload)
  const blob = new Blob([body], { type: "application/json" })

  if (navigator.sendBeacon?.(url, blob)) return true

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined)

  return true
}

function dispatchArohaa(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return

  const fn = (window as Window & { arohaa?: ArohaaCallable }).arohaa
  if (fn) {
    if (typeof fn.track === "function") {
      fn.track(event, props ?? {})
      return
    }
    if (typeof fn === "function") {
      fn(event, props ?? {})
      return
    }
  }

  beaconIngest(event, props)
}

export function arohaaTrack(
  event: string,
  props?: Record<string, unknown>,
): void {
  dispatchArohaa(event, props)
}

export function arohaaTrackFormStart(formId?: string): void {
  arohaaTrack("form_start", formId ? { formId } : {})
}

export function arohaaTrackFormSubmit(formId?: string): void {
  arohaaTrack("form_submit", formId ? { formId } : {})
}

export function arohaaTrackFormSuccess(formId?: string): void {
  arohaaTrack("form_success", formId ? { formId } : {})
}
