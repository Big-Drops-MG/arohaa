"use client"

import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"

type SeoImportPanelProps = {
  projectId: string
  onSynced: () => void
}

type ImportRow = {
  query: string
  pageUrl: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  reportDate: string
}

function normalizeRows(raw: unknown): ImportRow[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && "rows" in raw
      ? (raw as { rows: unknown }).rows
      : null

  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("JSON must contain a non-empty rows array")
  }

  return source.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Row ${index + 1} is invalid`)
    }
    const row = entry as Record<string, unknown>
    const query = String(row.query ?? "").trim()
    const pageUrl = String(row.pageUrl ?? row.page_url ?? "").trim()
    const reportDate = String(row.reportDate ?? row.report_date ?? "").trim()

    if (!query || !pageUrl || !reportDate) {
      throw new Error(
        `Row ${index + 1} is missing query, pageUrl, or reportDate`
      )
    }

    return {
      query,
      pageUrl,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
      reportDate,
    }
  })
}

export function SeoImportPanel({ projectId, onSynced }: SeoImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncRows = async (rows: ImportRow[]) => {
    const res = await fetch(
      `/api/landing-pages/${encodeURIComponent(projectId)}/seo`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      }
    )

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(body?.error ?? "SEO sync failed")
    }

    onSynced()
  }

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return

    setSyncing(true)
    setError(null)

    try {
      const rows = normalizeRows(JSON.parse(await file.text()))
      await syncRows(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setSyncing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleFileChange(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={syncing}
        onClick={() => inputRef.current?.click()}
      >
        {syncing ? "Syncing..." : "Import SEO data"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
