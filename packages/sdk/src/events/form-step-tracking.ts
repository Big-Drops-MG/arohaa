import { trackFormStepView } from "./form-step.events"

const seenSteps = new Set<string>()
let stepTrackingInstalled = false

function stepKey(formId: string | undefined, stepIndex: number): string {
  return `${formId ?? "default"}:${stepIndex}`
}

function parseStepIndex(el: Element): number | null {
  const raw =
    el.getAttribute("data-arohaa-step") ??
    el.getAttribute("data-step")
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function formIdFromElement(el: Element): string | undefined {
  const form = el.closest("form")
  if (!form) return undefined
  const id = form.id?.trim()
  if (id) return id
  return form.getAttribute("name")?.trim() || undefined
}

export function setupFormStepTracking(): void {
  if (stepTrackingInstalled || typeof document === "undefined") return
  if (typeof IntersectionObserver === "undefined") return

  stepTrackingInstalled = true

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue
        const el = entry.target
        const stepIndex = parseStepIndex(el)
        if (!stepIndex) continue

        const formId = formIdFromElement(el)
        const key = stepKey(formId, stepIndex)
        if (seenSteps.has(key)) continue
        seenSteps.add(key)

        const stepName =
          el.getAttribute("data-arohaa-step-name")?.trim() ||
          el.getAttribute("aria-label")?.trim() ||
          undefined

        trackFormStepView(stepIndex, { formId, stepName })
      }
    },
    { threshold: [0.5] },
  )

  const observeSteps = () => {
    document
      .querySelectorAll("[data-arohaa-step], [data-step]")
      .forEach((el) => observer.observe(el))
  }

  observeSteps()

  if (typeof MutationObserver !== "undefined") {
    const mo = new MutationObserver(() => observeSteps())
    mo.observe(document.documentElement, { childList: true, subtree: true })
  }
}
