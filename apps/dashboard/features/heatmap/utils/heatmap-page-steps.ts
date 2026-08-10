export function canonicalizeHeatmapPageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const u = new URL(trimmed)
    const hash = u.hash || ""
    u.search = ""
    u.hash = ""
    const base = u.toString().replace(/\?$/, "")
    return `${base}${hash}`
  } catch {
    return trimmed.replace(/\?[^#]*/, "")
  }
}

export function heatmapFormKey(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, "") || u.origin
  } catch {
    return url
  }
}

export function heatmapStepSlug(url: string): string {
  try {
    const hash = new URL(url).hash.replace(/^#\/?/, "").trim()
    return hash || "start"
  } catch {
    return "start"
  }
}

export function heatmapStepLabel(url: string): string {
  const slug = heatmapStepSlug(url)
  if (slug === "start") return "Start"
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function titleCasePathSegment(segment: string): string {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

const KNOWN_PAGE_LABELS: Record<string, string> = {
  "": "Homepage",
  home: "Homepage",
  homepage: "Homepage",
  index: "Homepage",
  privacy: "Privacy Policy",
  "privacy-policy": "Privacy Policy",
  privacypolicy: "Privacy Policy",
  contact: "Contact",
  "contact-us": "Contact",
  contactus: "Contact",
  form: "Form",
  offer: "Form",
  quote: "Form",
  "auto-quote": "Form",
}

function isFormHost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h.startsWith("auto-quote.") ||
    h.startsWith("quote.") ||
    h.startsWith("offer.") ||
    h.startsWith("form.") ||
    /(^|\.)auto-quote\./.test(h)
  )
}

export function heatmapFormLabel(
  formKey: string,
  options?: { steps?: string[] }
): string {
  try {
    const href = formKey.includes("://") ? formKey : `https://${formKey}`
    const u = new URL(href)
    const segments = u.pathname.split("/").filter(Boolean)
    const last = (segments[segments.length - 1] ?? "").toLowerCase()
    const hasHashSteps = (options?.steps ?? []).some(
      (step) => heatmapStepSlug(step) !== "start"
    )

    if (segments.length === 0) {
      if (hasHashSteps || isFormHost(u.host)) return "Form"
      return "Homepage"
    }

    const known = KNOWN_PAGE_LABELS[last]
    if (known) return known

    if (last.includes("privacy")) return "Privacy Policy"
    if (last.includes("contact")) return "Contact"
    if (
      last.includes("form") ||
      last.includes("quote") ||
      last.includes("offer")
    ) {
      return "Form"
    }

    return segments.map(titleCasePathSegment).join(" / ")
  } catch {
    return formKey
  }
}

export function buildHeatmapStepUrl(formKey: string, stepSlug: string): string {
  const base = formKey.replace(/\/$/, "")
  if (!stepSlug || stepSlug === "start") return `${base}/`
  return `${base}/#/${stepSlug.replace(/^\//, "")}`
}

export function heatmapPreviewSrc(url: string): string {
  try {
    const u = new URL(canonicalizeHeatmapPageUrl(url))
    const slug = heatmapStepSlug(u.href)
    // Load the host document only — Quotifii-style SPAs ignore/reset hash deep
    // links. The dashboard asks the framed SDK to reveal the step via postMessage.
    u.search = ""
    u.hash = ""
    u.searchParams.set("_hm", slug)
    return u.toString()
  } catch {
    return url
  }
}

export function findHeatmapStepIndex(
  steps: string[],
  selected: string
): number {
  const canon = canonicalizeHeatmapPageUrl(selected)
  if (!canon || steps.length === 0) return 0
  const exact = steps.indexOf(canon)
  if (exact >= 0) return exact
  const want = heatmapStepSlug(canon)
  const bySlug = steps.findIndex((step) => heatmapStepSlug(step) === want)
  return bySlug >= 0 ? bySlug : 0
}

export function groupHeatmapFormSteps(pageUrls: string[]): {
  formKey: string
  formLabel: string
  steps: string[]
}[] {
  const map = new Map<string, string[]>()
  for (const raw of pageUrls) {
    const url = canonicalizeHeatmapPageUrl(raw)
    if (!url) continue
    const key = heatmapFormKey(url)
    const list = map.get(key) ?? []
    if (!list.includes(url)) list.push(url)
    map.set(key, list)
  }

  const groups = Array.from(map.entries()).map(([formKey, steps]) => ({
    formKey,
    formLabel: heatmapFormLabel(formKey, { steps }),
    steps,
  }))

  const labelCounts = new Map<string, number>()
  for (const group of groups) {
    labelCounts.set(
      group.formLabel,
      (labelCounts.get(group.formLabel) ?? 0) + 1
    )
  }

  return groups.map((group) => {
    if ((labelCounts.get(group.formLabel) ?? 0) <= 1) return group
    try {
      const href = group.formKey.includes("://")
        ? group.formKey
        : `https://${group.formKey}`
      const u = new URL(href)
      const path = u.pathname.replace(/\/$/, "") || "/"
      return {
        ...group,
        formLabel: `${group.formLabel} (${u.host}${path === "/" ? "" : path})`,
      }
    } catch {
      return group
    }
  })
}
