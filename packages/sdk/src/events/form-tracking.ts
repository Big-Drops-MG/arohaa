import { getConfig } from "../model/config"
import { trackFormStart, trackFormSubmit, trackFormSuccess } from "./form.events"
import {
  formIdFromForm,
  formSubmitsToInternalApi,
  findZipFormRoot,
  findZipSubmitControl,
  isMarkedArohaaField,
  isSubmitFormUrl,
  isValidZipValue,
  isWithinZipForm,
  isZipFormType,
  isZipInput,
  normalizeZipValue,
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
import { trackZipStart, trackZipSubmit } from "./zip.events"

const startedForms = new WeakSet<HTMLFormElement>()
const startedStandaloneZip = new WeakSet<HTMLElement>()
const startedStandaloneFields = new WeakSet<HTMLElement>()
let zipStartFired = false
let submitFormSuccessObserverInstalled = false
let submitTrackingInstalled = false
let zipClickTrackingInstalled = false

export { isSubmitFormUrl }

function resolveZipForSubmit(formId?: string, zip?: string): string | undefined {
  if (zip && isValidZipValue(zip)) return normalizeZipValue(zip)

  if (typeof document === "undefined") return undefined

  if (formId && formId !== "zip") {
    const el = document.getElementById(formId)
    if (el instanceof HTMLFormElement) {
      const fromForm = readZipValue(el)
      if (fromForm) return fromForm
    }
  }

  const fromPage = readZipValue(document)
  return fromPage ?? undefined
}

function fireZipSubmitIfApplicable(formId?: string, zip?: string): void {
  if (!isZipFormType()) return
  trackZipSubmit(formId, resolveZipForSubmit(formId, zip))
}

function fireZipStartIfApplicable(formId?: string): void {
  if (!isZipFormType()) return
  if (zipStartFired) return
  zipStartFired = true
  trackZipStart(formId)
}

function fireFormSuccessOnSubmit(form: HTMLFormElement): void {
  const id = formIdFromForm(form)
  if (hasFormSessionSucceeded(id)) return

  const zip = resolveZipForSubmit(id)

  fireZipStartIfApplicable(id)
  trackFormSuccess(id, zip)
  fireZipSubmitIfApplicable(id, zip)
  markFormSessionSucceeded(id)
}

function handleZipControlSubmit(control: HTMLElement): void {
  const root = findZipFormRoot(control)
  const zip = readZipValue(root)
  if (!zip || !isValidZipValue(zip)) return

  const form = control.closest("form")
  const formId = form ? formIdFromForm(form) : "zip"
  if (hasFormSessionSucceeded(formId)) return

  fireZipStartIfApplicable(formId)
  trackFormSubmit(formId, zip)
  trackFormSuccess(formId, zip)
  fireZipSubmitIfApplicable(formId, zip)
  markFormSessionSucceeded(formId)
}

export function installSubmitFormSuccessObserver(): void {
  if (submitFormSuccessObserverInstalled || typeof window === "undefined") {
    return
  }
  if (typeof PerformanceObserver === "undefined") return

  submitFormSuccessObserverInstalled = true

  const onSuccess = (): void => {
    if (hasFormSessionSucceeded()) return
    const zip = resolveZipForSubmit()
    fireZipStartIfApplicable()
    trackFormSuccess(undefined, zip)
    fireZipSubmitIfApplicable(undefined, zip)
    markFormSessionSucceeded()
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming
        if (!isSubmitFormUrl(resource.name)) continue
        const status = resource.responseStatus
        if (typeof status === "number") {
          if (status < 200 || status >= 300) continue
        }
        onSuccess()
      }
    })
    observer.observe({ type: "resource", buffered: true })
  } catch {
    submitFormSuccessObserverInstalled = false
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
          fireZipStartIfApplicable("zip")
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
      if (!form) return
      if (isWithinZipForm(target)) fireZipStartIfApplicable(formIdFromForm(form))
      if (startedForms.has(form)) return
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
          fireZipStartIfApplicable("zip")
          trackFormStart("zip")
        }
        return
      }

      const form = target.closest("form")
      if (!form) return
      if (isWithinZipForm(target)) fireZipStartIfApplicable(formIdFromForm(form))
      if (startedForms.has(form)) return
      startedForms.add(form)
      markFormSessionStarted(form)
      trackFormStart(formIdFromForm(form))
    },
    true,
  )
}

export function setupFormTracking(options?: {
  trackFieldFocus?: boolean
  trackFormSuccess?: boolean
}): void {
  if (getConfig().formtype === "none") return

  const trackSuccess = options?.trackFormSuccess !== false
  if (trackSuccess) {
    installSubmitFormSuccessObserver()
    setupFormSubmitTracking()
    setupZipSubmitClickTracking()
  }
  setupFormDomTracking()
  if (options?.trackFieldFocus !== false) {
    setupFormFieldTracking()
  }
  setupFormStepTracking()
}
