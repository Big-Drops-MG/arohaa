"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Lock, PhoneCall, Upload } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type {
  CallCenterOutcomesPayload,
  CallCenterSourceRollupRow,
} from "@/features/data-lab/model/call-center-csv"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

const thClassName =
  "px-4 py-3 text-right text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground"
const tdClassName = "px-4 py-3 text-right text-sm tabular-nums text-foreground"

function pct(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%"
  return `${Math.round(rate * 1000) / 10}%`
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

type DataLabCallCenterPanelProps = {
  projectId: string
  canAccess: boolean
  isActive: boolean
}

export function DataLabCallCenterPanel({
  projectId,
  canAccess,
  isActive,
}: DataLabCallCenterPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<CallCenterOutcomesPayload | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const loadSummary = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/landing-pages/${encodeURIComponent(projectId)}/call-center-outcomes`,
          { cache: "no-store", signal }
        )
        if (!res.ok) throw new Error(`load ${res.status}`)
        const json = (await res.json()) as CallCenterOutcomesPayload
        if (signal?.aborted) return
        setData(json)
      } catch (err) {
        if (signal?.aborted) return
        if (err instanceof Error && err.name === "AbortError") return
        setError("Failed to load call-center outcomes.")
        setData(null)
      } finally {
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    if (!isActive || !canAccess) return
    const controller = new AbortController()
    void loadSummary(controller.signal)
    return () => controller.abort()
  }, [canAccess, isActive, loadSummary])

  const onUpload = useCallback(
    async (file: File) => {
      setIsUploading(true)
      setUploadMessage(null)
      setError(null)
      try {
        const form = new FormData()
        form.set("file", file)
        const res = await fetch(
          `/api/landing-pages/${encodeURIComponent(projectId)}/call-center-outcomes`,
          {
            method: "POST",
            body: form,
          }
        )
        const json = (await res.json().catch(() => null)) as {
          error?: string
          rowCount?: number
          upserted?: number
          sources?: CallCenterSourceRollupRow[]
        } | null
        if (!res.ok) {
          throw new Error(json?.error || `upload ${res.status}`)
        }
        setUploadMessage(
          `Imported ${formatCount(json?.rowCount ?? 0)} rows (${formatCount(json?.upserted ?? 0)} upserted).`
        )
        await loadSummary()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.")
      } finally {
        setIsUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [loadSummary, projectId]
  )

  if (!canAccess) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
        <Lock className="size-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Call outcomes are restricted
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Call-center uploads are only available to approved operators.
          </p>
        </div>
      </div>
    )
  }

  const sources = data?.sources ?? []
  const totals = data?.totals

  return (
    <div className="space-y-5">
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          "pb-2"
        )}
      >
        <CardHeader
          className={cn(
            overviewAnalyticCardHeaderClassName,
            "justify-between gap-3"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <PhoneCall className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className={overviewSectionHeadingClassName}>
                Call outcomes
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Upload call-center lead logs to see contact and transfer rates
                by SID (utm_source). Aggregates are precomputed for fast loads.
              </p>
              {uploadMessage ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploadMessage}
                </p>
              ) : null}
              {error ? (
                <p className="mt-1 text-xs text-rose-700">{error}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onUpload(file)
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              disabled={isUploading || isLoading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              {isUploading ? "Uploading…" : "Upload CSV"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Leads", totals?.leads ?? 0],
              ["Contacted", totals?.contacted ?? 0],
              ["Transferred", totals?.transferred ?? 0],
              ["15m+", totals?.duration15m ?? 0],
              ["20m+", totals?.duration20m ?? 0],
              ["Duplicates", totals?.duplicates ?? 0],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-border px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-sm font-medium tabular-nums">
                  {formatCount(Number(value))}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          "pb-2"
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            By source (SID)
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "overflow-hidden p-0",
            (isLoading || isUploading) && "pointer-events-none opacity-60"
          )}
        >
          {sources.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {isLoading
                ? "Loading call outcomes…"
                : "No call-center uploads yet. Upload a CSV to populate this table."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-max min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className={cn(thClassName, "text-left")}>Source</th>
                    <th className={thClassName}>Leads</th>
                    <th className={thClassName}>Contacted</th>
                    <th className={thClassName}>Transferred</th>
                    <th className={thClassName}>Contact %</th>
                    <th className={thClassName}>Transfer %</th>
                    <th className={thClassName}>15m+</th>
                    <th className={thClassName}>20m+</th>
                    <th className={thClassName}>Dupes</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((row) => (
                    <tr
                      key={row.sid}
                      className="border-b border-border last:border-b-0 hover:bg-muted/20"
                    >
                      <td
                        className={cn(
                          tdClassName,
                          "max-w-[12rem] text-left font-medium"
                        )}
                      >
                        {row.sid}
                      </td>
                      <td className={tdClassName}>{row.leads}</td>
                      <td className={tdClassName}>{row.contacted}</td>
                      <td className={tdClassName}>{row.transferred}</td>
                      <td className={tdClassName}>{pct(row.contactRate)}</td>
                      <td className={tdClassName}>{pct(row.transferRate)}</td>
                      <td className={tdClassName}>{row.duration15m}</td>
                      <td className={tdClassName}>{row.duration20m}</td>
                      <td className={tdClassName}>{row.duplicates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.uploads && data.uploads.length > 0 ? (
        <Card
          className={cn(
            overviewCardPointerFocusResetClassName,
            overviewAnalyticCardShellClassName,
            "pb-2"
          )}
        >
          <CardHeader className={overviewAnalyticCardHeaderClassName}>
            <CardTitle className={overviewSectionHeadingClassName}>
              Recent uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {data.uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-b-0"
              >
                <p className="min-w-0 truncate font-medium">
                  {upload.fileName}
                </p>
                <p className="text-muted-foreground tabular-nums">
                  {formatCount(upload.rowCount)} rows ·{" "}
                  {formatCount(upload.contactedCount)} contacted ·{" "}
                  {new Date(upload.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
