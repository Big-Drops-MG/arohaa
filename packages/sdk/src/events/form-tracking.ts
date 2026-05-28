import { trackFormStart, trackFormSuccess } from "./form.events"

const startedForms = new WeakSet<HTMLFormElement>()
let fetchTrackingInstalled = false

function formId(form: HTMLFormElement): string | undefined {
  const id = form.id?.trim()
  if (id) return id
  const name = form.getAttribute("name")?.trim()
  return name || undefined
}

function isSubmitFormUrl(url: string): boolean {
  try {
    const path = new URL(url, window.location.origin).pathname
    return path.endsWith("/api/submit-form")
  } catch {
    return url.includes("/api/submit-form")
  }
}

export function installFormFetchTracking(): void {
  if (fetchTrackingInstalled || typeof window === "undefined") return
  if (typeof window.fetch !== "function") return

  fetchTrackingInstalled = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async function arohaaFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase()
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input)

    const response = await nativeFetch(input, init)

    if (method === "POST" && isSubmitFormUrl(url)) {
      try {
        const clone = response.clone()
        const data = (await clone.json()) as {
          success?: boolean
          rejected?: boolean
        }
        if (response.ok && data.success !== false && !data.rejected) {
          trackFormSuccess()
        }
      } catch {
        if (response.ok) trackFormSuccess()
      }
    }

    return response
  }
}

export function setupFormDomTracking(): void {
  if (typeof document === "undefined") return

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      const form = target.closest("form")
      if (!form || startedForms.has(form)) return
      startedForms.add(form)
      trackFormStart(formId(form))
    },
    true,
  )

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      const form = target.closest("form")
      if (!form || startedForms.has(form)) return
      startedForms.add(form)
      trackFormStart(formId(form))
    },
    true,
  )

}

export function setupFormTracking(): void {
  installFormFetchTracking()
  setupFormDomTracking()
}
