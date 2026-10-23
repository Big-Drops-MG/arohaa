"use client"

import { useEffect, useState } from "react"

type UtmSourceTrustRow = {
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
  reputation: "clean" | "location_mismatch_cluster" | "unknown"
}

function pct(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%"
  return `${Math.round(rate * 1000) / 10}%`
}

function reputationLabel(status: UtmSourceTrustRow["reputation"]): string {
  if (status === "location_mismatch_cluster") return "Cluster"
  if (status === "clean") return "Clean"
  return "—"
}

export function UtmSourceTrustPanel() {
  const [sources, setSources] = useState<UtmSourceTrustRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/warehouse/utm-source-trust", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as { sources?: UtmSourceTrustRow[] }
      })
      .then((body) => {
        if (!cancelled)
          setSources(Array.isArray(body.sources) ? body.sources : [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>
  }
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No UTM source rows yet. Submitted leads with assessed location signals
        will populate this table.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-xs text-muted-foreground">
        Trust is the average assessed lead score. Cluster marks sources with
        ≥50% ZIP/IP location mismatch over 30 days (n≥10). Mismatch counts use
        the location_inconsistency finding.
      </p>
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground uppercase">
            <th className="py-2 pr-3">UTM source</th>
            <th className="py-2 pr-3 text-right">Trust</th>
            <th className="py-2 pr-3 text-right">Status</th>
            <th className="py-2 pr-3 text-right">Leads</th>
            <th className="py-2 pr-3 text-right">7d</th>
            <th className="py-2 pr-3 text-right">30d</th>
            <th className="py-2 pr-3 text-right">Mismatch</th>
            <th className="py-2 pr-3 text-right">7d mm</th>
            <th className="py-2 pr-3 text-right">30d mm</th>
            <th className="py-2 pr-3 text-right">7d %</th>
            <th className="py-2 pr-3 text-right">30d %</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((row) => (
            <tr key={row.utmSource} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium">{row.utmSource}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.trustScore == null ? "—" : row.trustScore}
              </td>
              <td
                className={`py-2 pr-3 text-right tabular-nums ${
                  row.reputation === "location_mismatch_cluster"
                    ? "text-rose-700"
                    : "text-muted-foreground"
                }`}
              >
                {reputationLabel(row.reputation)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.leadsTotal}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.leads7d}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.leads30d}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.mismatchTotal}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.mismatch7d}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.mismatch30d}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {pct(row.mismatchRate7d)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {pct(row.mismatchRate30d)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
