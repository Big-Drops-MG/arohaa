import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import { leadSourceLabel } from "@/features/data-lab/model/lead-review"

export const UTM_SOURCE_TRUST_MIN_SUBMITS = 10
export const UTM_SOURCE_TRUST_MISMATCH_RATE = 0.5

export type UtmSourceTrustReputation =
  | "clean"
  | "location_mismatch_cluster"
  | "unknown"

export type UtmSourceTrustRow = {
  utmSource: string
  trustScore: number | null
  leadsTotal: number
  leads7d: number
  leads30d: number
  mismatchTotal: number
  mismatch7d: number
  mismatch30d: number
  mismatchRate7d: number
  mismatchRate30d: number
  reputation: UtmSourceTrustReputation
}

type Bucket = {
  utmSource: string
  scoreSum: number
  scoreCount: number
  leadsTotal: number
  leads7d: number
  leads30d: number
  mismatchTotal: number
  mismatch7d: number
  mismatch30d: number
}

function leadTimestampMs(lead: DataExportLeadRow): number {
  const raw = (lead.submittedAt || lead.createdAt || "").trim()
  if (!raw) return Number.NaN
  const normalized = raw.includes("T")
    ? raw
    : `${raw.replace(" ", "T")}${/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? "" : "Z"}`
  return new Date(normalized).getTime()
}

export function leadHasLocationMismatch(lead: DataExportLeadRow): boolean {
  const findings = lead.fraud?.findings ?? []
  return findings.some(
    (finding) =>
      finding.code === "location_inconsistency" ||
      /location_inconsistency/i.test(finding.detail || "")
  )
}

export function evaluateUtmSourceTrustReputation(input: {
  source: string
  submitCount: number
  locationMismatchCount: number
}): UtmSourceTrustReputation {
  const source = input.source.trim()
  const submitCount = Math.max(0, Math.floor(input.submitCount))
  const locationMismatchCount = Math.max(
    0,
    Math.min(submitCount, Math.floor(input.locationMismatchCount))
  )
  const rate = submitCount > 0 ? locationMismatchCount / submitCount : 0
  if (!source || source === "—") return "unknown"
  if (submitCount < UTM_SOURCE_TRUST_MIN_SUBMITS) return "unknown"
  if (rate >= UTM_SOURCE_TRUST_MISMATCH_RATE) return "location_mismatch_cluster"
  return "clean"
}

export function computeUtmSourceTrustRows(
  leads: DataExportLeadRow[],
  nowMs: number = Date.now()
): UtmSourceTrustRow[] {
  const dayMs = 24 * 60 * 60 * 1000
  const cutoff7 = nowMs - 7 * dayMs
  const cutoff30 = nowMs - 30 * dayMs
  const buckets = new Map<string, Bucket>()

  for (const lead of leads) {
    const utmSource = leadSourceLabel(lead)
    let bucket = buckets.get(utmSource)
    if (!bucket) {
      bucket = {
        utmSource,
        scoreSum: 0,
        scoreCount: 0,
        leadsTotal: 0,
        leads7d: 0,
        leads30d: 0,
        mismatchTotal: 0,
        mismatch7d: 0,
        mismatch30d: 0,
      }
      buckets.set(utmSource, bucket)
    }

    bucket.leadsTotal += 1
    const ts = leadTimestampMs(lead)
    const in7 = Number.isFinite(ts) && ts >= cutoff7
    const in30 = Number.isFinite(ts) && ts >= cutoff30
    if (in7) bucket.leads7d += 1
    if (in30) bucket.leads30d += 1

    const fraud = lead.fraud
    if (
      fraud?.scoreAvailable &&
      fraud.score != null &&
      Number.isFinite(fraud.score)
    ) {
      bucket.scoreSum += fraud.score
      bucket.scoreCount += 1
    }

    if (leadHasLocationMismatch(lead)) {
      bucket.mismatchTotal += 1
      if (in7) bucket.mismatch7d += 1
      if (in30) bucket.mismatch30d += 1
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const mismatchRate7d =
        bucket.leads7d > 0 ? bucket.mismatch7d / bucket.leads7d : 0
      const mismatchRate30d =
        bucket.leads30d > 0 ? bucket.mismatch30d / bucket.leads30d : 0
      return {
        utmSource: bucket.utmSource,
        trustScore:
          bucket.scoreCount > 0
            ? Math.round(bucket.scoreSum / bucket.scoreCount)
            : null,
        leadsTotal: bucket.leadsTotal,
        leads7d: bucket.leads7d,
        leads30d: bucket.leads30d,
        mismatchTotal: bucket.mismatchTotal,
        mismatch7d: bucket.mismatch7d,
        mismatch30d: bucket.mismatch30d,
        mismatchRate7d,
        mismatchRate30d,
        reputation: evaluateUtmSourceTrustReputation({
          source: bucket.utmSource,
          submitCount: bucket.leads30d,
          locationMismatchCount: bucket.mismatch30d,
        }),
      } satisfies UtmSourceTrustRow
    })
    .sort((a, b) => {
      if (b.leadsTotal !== a.leadsTotal) return b.leadsTotal - a.leadsTotal
      return a.utmSource.localeCompare(b.utmSource)
    })
}
