"use client"

import { useEffect, useState } from "react"

type PartnerCard = {
  partner: string
  submissions: number
  elevatedRisk: number
  incompleteAssessments: number
  reviewed: number
  wrongNumber: number
  neverRequested: number
  converted: number
}

export function PartnerScorecardsPanel() {
  const [partners, setPartners] = useState<PartnerCard[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/warehouse/partner-scorecards", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as { partners?: PartnerCard[] }
      })
      .then((body) => {
        if (!cancelled)
          setPartners(Array.isArray(body.partners) ? body.partners : [])
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
  if (partners.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No partner scorecard rows yet. Contact keys and call outcomes will
        populate this table.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground uppercase">
            <th className="py-2 pr-3">Partner</th>
            <th className="py-2 pr-3 text-right">Submissions</th>
            <th className="py-2 pr-3 text-right">Reviewed</th>
            <th className="py-2 pr-3 text-right">Wrong number</th>
            <th className="py-2 pr-3 text-right">Never requested</th>
            <th className="py-2 pr-3 text-right">Converted</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((row) => (
            <tr key={row.partner} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium">{row.partner}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.submissions}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.reviewed}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.wrongNumber}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.neverRequested}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.converted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
