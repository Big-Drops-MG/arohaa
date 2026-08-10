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

export function buildHeatmapStepUrl(formKey: string, stepSlug: string): string {
  const base = formKey.replace(/\/$/, "")
  if (!stepSlug || stepSlug === "start") return `${base}/`
  return `${base}/#/${stepSlug.replace(/^\//, "")}`
}

export function heatmapPreviewSrc(url: string): string {
  try {
    const u = new URL(canonicalizeHeatmapPageUrl(url))
    const slug = heatmapStepSlug(u.href)
    u.search = ""
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
  return Array.from(map.entries()).map(([formKey, steps]) => {
    let formLabel = formKey
    try {
      formLabel = new URL(
        formKey.includes("://") ? formKey : `https://${formKey}`
      ).host
    } catch {
      /* keep formKey */
    }
    return { formKey, formLabel, steps }
  })
}
