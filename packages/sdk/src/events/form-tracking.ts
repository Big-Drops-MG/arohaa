import { trackFormStart, trackFormSubmit, trackFormSuccess } from "./form.events"
import {
  formIdFromForm,
  formSubmitsToInternalApi,
  findZipFormRoot,
  findZipSubmitControl,
  isMarkedArohaaField,
  isSubmitFormUrl,
  isValidZipValue,
  isZipFormType,
  isZipInput,
  readZipValue,
} from "./form-dom.utils"
import {
  hasFormSessionSucceeded,
  markFormSessionStarted,
  markFormSessionSucceeded,
  markStandaloneZipStarted,
  setupFormFieldTracking,
} from "./form-field-tracking"
import { setupFormStepTracking } from "./form-step-tracking"
import { trackZipSubmit } from "./zip.events"

const startedForms = new WeakSet<HTMLFormElement>()
const startedStandaloneZip = new WeakSet<HTMLElement>()
const startedStandaloneFields = new WeakSet<HTMLElement>()
let fetchTrackingInstalled = false
let submitTrackingInstalled = false
let zipClickTrackingInstalled = false

export { isSubmitFormUrl }

function fireZipSubmitIfApplicable(formId?: string): void {
  if (!isZipFormType()) return
  trackZipSubmit(formId)
}

function fireFormSuccessOnSubmit(form: HTMLFormElement): void {
  const id = formIdFromForm(form)
  if (hasFormSessionSucceeded(id)) return

  trackFormSuccess(id)
  fireZipSubmitIfApplicable(id)
  markFormSessionSucceeded(id)
}

function handleZipControlSubmit(control: HTMLElement): void {
  const root = findZipFormRoot(control)
  const zip = readZipValue(root)
  if (!zip || !isValidZipValue(zip)) return

  const form = control.closest("form")
  const formId = form ? formIdFromForm(form) : "zip"
  if (hasFormSessionSucceeded(formId)) return

  trackFormSubmit(formId)
  trackFormSuccess(formId)
  fireZipSubmitIfApplicable(formId)
  markFormSessionSucceeded(formId)
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
          if (!hasFormSessionSucceeded()) {
            trackFormSuccess()
            fireZipSubmitIfApplicable()
            markFormSessionSucceeded()
          }
        }
      } catch {
        if (response.ok && !hasFormSessionSucceeded()) {
          trackFormSuccess()
          fireZipSubmitIfApplicable()
          markFormSessionSucceeded()
        }
      }
    }

    return response
  }
}

function setupFormSubmitTracking(): void {
  if (submitTrackingInstalled || typeof document === "undefined") return
  submitTrackingInstalled = true

  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target
      if (!(form instanceof HTMLFormElement)) return

      const id = formIdFromForm(form)
      trackFormSubmit(id)

      if (!formSubmitsToInternalApi(form)) {
        fireFormSuccessOnSubmit(form)
      }
    },
    true,
  )
}

function setupZipSubmitClickTracking(): void {
  if (zipClickTrackingInstalled || typeof document === "undefined") return
  zipClickTrackingInstalled = true

  document.addEventListener(
    "click",
    (e) => {
      const control = findZipSubmitControl(e.target)
      if (!control) return
      if (control.closest("form")) return
      handleZipControlSubmit(control)
    },
    true,
  )
}

export function setupFormDomTracking(): void {
  if (typeof document === "undefined") return

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return

      if (isZipInput(target) && !target.closest("form")) {
        if (!startedStandaloneZip.has(target)) {
          startedStandaloneZip.add(target)
          markStandaloneZipStarted()
          trackFormStart("zip")
        }
        return
      }

      if (isMarkedArohaaField(target) && !target.closest("form")) {
        if (!startedStandaloneFields.has(target)) {
          startedStandaloneFields.add(target)
          const root = target.closest("[data-arohaa-form]")
          const formId =
            (root instanceof HTMLElement && root.id?.trim()) ||
            target.getAttribute("data-arohaa-field")?.trim() ||
            "standalone"
          trackFormStart(formId)
        }
        return
      }

      const form = target.closest("form")
      if (!form || startedForms.has(form)) return
      startedForms.add(form)
      markFormSessionStarted(form)
      trackFormStart(formIdFromForm(form))
    },
    true,
  )

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return

      if (isZipInput(target) && !target.closest("form")) {
        if (!startedStandaloneZip.has(target)) {
          startedStandaloneZip.add(target)
          markStandaloneZipStarted()
          trackFormStart("zip")
        }
        return
      }

      const form = target.closest("form")
      if (!form || startedForms.has(form)) return
      startedForms.add(form)
      markFormSessionStarted(form)
      trackFormStart(formIdFromForm(form))
    },
    true,
  )
}

export function setupFormTracking(): void {
  installFormFetchTracking()
  setupFormSubmitTracking()
  setupZipSubmitClickTracking()
  setupFormDomTracking()
  setupFormFieldTracking()
  setupFormStepTracking()
}
