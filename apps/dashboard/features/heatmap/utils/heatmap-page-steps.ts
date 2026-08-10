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

export function heatmapStepLabel(url: string): string {
  try {
    const u = new URL(url)
    const hash = u.hash.replace(/^#\/?/, "").trim()
    if (!hash) return "Start"
    return hash
      .split(/[-_/]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  } catch {
    return url
  }
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
