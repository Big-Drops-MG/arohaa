"use client"

import { useEffect, useState } from "react"

type CalibrationPayload = {
  sampleSize: number
  markedInvalid: number
  wrongNumber: number
  converted: number
  findingRates: Array<{ code: string; count: number; withInvalid: number }>
  note: string
}

export function CalibrationPanel() {
  const [data, setData] = useState<CalibrationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/warehouse/calibration", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as CalibrationPayload
      })
      .then((body) => {
        if (!cancelled) setData(body)
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
  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.note}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Reviewed sample</p>
          <p className="text-lg font-semibold tabular-nums">
            {data.sampleSize}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Marked invalid</p>
          <p className="text-lg font-semibold tabular-nums">
            {data.markedInvalid}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Wrong number</p>
          <p className="text-lg font-semibold tabular-nums">
            {data.wrongNumber}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Converted</p>
          <p className="text-lg font-semibold tabular-nums">{data.converted}</p>
        </div>
      </div>
      {data.findingRates.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase">
              <th className="py-2 pr-3">Finding</th>
              <th className="py-2 pr-3 text-right">In reviewed</th>
              <th className="py-2 pr-3 text-right">With invalid</th>
            </tr>
          </thead>
          <tbody>
            {data.findingRates.map((row) => (
              <tr key={row.code} className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {row.count}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {row.withInvalid}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">
          No reviewed finding overlap yet.
        </p>
      )}
    </div>
  )
}
