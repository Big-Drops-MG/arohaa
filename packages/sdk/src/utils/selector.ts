const STABLE_DATA_ATTRS = [
  "data-testid",
  "data-qa",
  "data-name",
  "data-id",
  "name",
  "aria-label",
] as const

const EPHEMERAL_CLASS =
  /^(?:css-|ng-|sc-|emotion-|jsx-|_[a-f0-9]{4,}|[a-zA-Z]+-[a-f0-9]{5,})$/i

const MAX_PATH_DEPTH = 5

function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function escapeIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value)
  }
  return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1")
}

function isValidId(id: string): boolean {
  return /^[A-Za-z][\w:-]*$/.test(id)
}

function stableClasses(el: Element): string[] {
  if (!(el instanceof HTMLElement) || !el.classList.length) return []
  const out: string[] = []
  for (const cls of Array.from(el.classList)) {
    if (!cls || EPHEMERAL_CLASS.test(cls)) continue
    out.push(cls)
    if (out.length >= 2) break
  }
  return out
}

function nthOfType(el: Element): number {
  const parent = el.parentElement
  if (!parent) return 1
  let n = 1
  for (const sibling of Array.from(parent.children)) {
    if (sibling === el) return n
    if (sibling.tagName === el.tagName) n += 1
  }
  return n
}

function segmentFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const classes = stableClasses(el)
  const classPart = classes.map((c) => `.${escapeIdent(c)}`).join("")
  const nth = nthOfType(el)
  const needsNth =
    nth > 1 ||
    (el.parentElement != null &&
      Array.from(el.parentElement.children).filter(
        (c) => c.tagName === el.tagName,
      ).length > 1)

  return needsNth
    ? `${tag}${classPart}:nth-of-type(${nth})`
    : `${tag}${classPart}`
}

function attrSelector(el: Element): string | null {
  for (const attr of STABLE_DATA_ATTRS) {
    const value = el.getAttribute(attr)
    if (!value || value.length > 80) continue
    const tag = el.tagName.toLowerCase()
    const sel = `${tag}[${attr}="${escapeIdent(value).replace(/"/g, '\\"')}"]`
    if (isUniqueSelector(sel)) return sel
  }
  return null
}

function pathSelector(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  let depth = 0

  while (
    current &&
    current !== document.documentElement &&
    depth < MAX_PATH_DEPTH
  ) {
    if (current.id && isValidId(current.id)) {
      const idSel = `#${escapeIdent(current.id)}`
      if (isUniqueSelector(idSel)) {
        parts.unshift(idSel)
        break
      }
    }

    parts.unshift(segmentFor(current))
    current = current.parentElement
    depth += 1
  }

  return parts.join(" > ")
}

export function getStableSelector(el: Element): string {
  if (el instanceof HTMLElement && el.id && isValidId(el.id)) {
    const idSel = `#${escapeIdent(el.id)}`
    if (isUniqueSelector(idSel)) return idSel
  }

  const byAttr = attrSelector(el)
  if (byAttr) return byAttr

  const path = pathSelector(el)
  return path || el.tagName.toLowerCase()
}
