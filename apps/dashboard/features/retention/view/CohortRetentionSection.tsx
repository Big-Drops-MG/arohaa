"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { CohortRetentionGrid } from "@/features/retention/view/CohortRetentionGrid"
import type { CohortRetentionRow } from "@/features/retention/utils/retention-matrix"

type SplitBy = "none" | "utm_source" | "utm_campaign"

type Props = {
  projectId: string
}

export function CohortRetentionSection({ projectId }: Props) {
  const { segmentId } = useDashboardSegmentFilter()
  const [splitBy, setSplitBy] = useState<SplitBy>("none")
  const [rows, setRows] = useState<CohortRetentionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (segmentId) params.set("segment_id", segmentId)
    if (splitBy !== "none") params.set("split_by", splitBy)

    const qs = params.toString()
    const url = `/api/landing-pages/${encodeURIComponent(projectId)}/cohorts${qs ? `?${qs}` : ""}`

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          throw new Error(body || `Failed (${res.status})`)
        }
        return res.json() as Promise<CohortRetentionRow[]>
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRows(Array.isArray(data) ? data : [])
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Failed to load cohorts")
        setRows([])
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [projectId, segmentId, splitBy])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Cohort retention</h3>
          <p className="text-xs text-muted-foreground">
            First-seen week cohorts with return rates through week +8
          </p>
        </div>
        <Select
          value={splitBy}
          onValueChange={(value) => setSplitBy(value as SplitBy)}
        >
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue placeholder="Split by channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All traffic</SelectItem>
            <SelectItem value="utm_source">By utm_source</SelectItem>
            <SelectItem value="utm_campaign">By utm_campaign</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : isLoading ? (
        <div className="rounded-md border px-4 py-10 text-center text-sm text-muted-foreground">
          Loading cohort retention…
        </div>
      ) : (
        <CohortRetentionGrid data={rows} />
      )}
    </div>
  )
}
