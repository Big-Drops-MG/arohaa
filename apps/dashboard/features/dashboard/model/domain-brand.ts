const MULTI_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.in",
  "co.za",
  "com.br",
  "com.mx",
  "co.jp",
])

const WORDS = new Set(
  `
  a about access advisor advisors affordable agency agent agents aid all
  alliance america american app apply approved assist assurance auto autos
  bank banking bargain base benefit benefits best better big bill bills bonus
  budget business buy buyer buyers buys car card cards care carrier cars cash center check
  cheap cheaper choice choices city claim claims clear click club coast compare
  comparison connect consumer cost costs cover coverage covered credit daily
  deal deals debt dental direct discount discounts drive driver drivers easy
  energy equity estate express fair family fast finance finder first fix fleet
  for free fresh friendly fund funding get global go gold good gov great green
  guard guide hand health help helper hero home homes house hub info insurance
  insure insured insurer instant investor journey key land lead leads lend
  lender lenders life line link loan loans local low lower market marketing
  match me medical medicare mint money mortgage mortgages motor my nation
  national network new now offer offers one online option options pay pet
  plan plans plus policy policies premium price prices pro protect protection
  provider providers quick quote quotes rate rates ready real refinance relief
  rent renter renters right safe safety sam save saver savers savings score secure
  select senior seniors service services shield shop simple smart solar
  solution solutions source spot star start state states stop store sure
  switch target tax team the today top total track trust truck trusted
  uncle united us usa value vehicle vehicles wallet way web wise world your
  `
    .split(/\s+/)
    .filter(Boolean)
)

function registrableLabel(hostname: string): string | null {
  const labels = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .split(".")
    .filter(Boolean)
  if (labels.length === 0) return null
  if (labels.length === 1) return labels[0]!
  const lastTwo = labels.slice(-2).join(".")
  if (MULTI_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels[labels.length - 3]!
  }
  return labels[labels.length - 2]!
}

/** Split a concatenated domain label into dictionary words, or null if it can't. */
export function segmentDomainLabel(label: string): string[] | null {
  const text = label.toLowerCase()
  const n = text.length
  const best: Array<string[] | null> = new Array(n + 1).fill(null)
  best[0] = []
  for (let end = 1; end <= n; end += 1) {
    for (let start = 0; start < end; start += 1) {
      const prefix = best[start]
      if (!prefix) continue
      const word = text.slice(start, end)
      if (!WORDS.has(word)) continue
      const candidate = [...prefix, word]
      const current = best[end]
      if (!current || candidate.length < current.length) best[end] = candidate
    }
  }
  return best[n] ?? null
}

function titleCase(word: string): string {
  if (word === "usa" || word === "us") return word.toUpperCase()
  return word.charAt(0).toUpperCase() + word.slice(1)
}

const LOCAL_BRAND = "Local Development"

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":")
  )
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname
  } catch {
    return null
  }
}

/** Human brand name from a landing page URL (autocoverage.quotifii.com → Quotifii). */
export function brandNameFromDomain(url: string): string | null {
  const hostname = hostnameFromUrl(url)
  if (!hostname) return null
  if (isLocalHostname(hostname)) return LOCAL_BRAND
  const label = registrableLabel(hostname)
  if (!label) return null

  const parts = label.split("-").filter(Boolean)
  const words = parts.flatMap((part) => segmentDomainLabel(part) ?? [part])
  return words.map(titleCase).join(" ")
}

/** Stable grouping key: the registrable domain (quotifii.com). */
export function brandKeyFromDomain(url: string): string | null {
  const hostname = hostnameFromUrl(url)
  if (!hostname) return null
  if (isLocalHostname(hostname)) return "local"
  const labels = hostname.toLowerCase().split(".").filter(Boolean)
  const lastTwo = labels.slice(-2).join(".")
  const take = MULTI_PART_SUFFIXES.has(lastTwo) && labels.length >= 3 ? 3 : 2
  return labels.slice(-take).join(".")
}
