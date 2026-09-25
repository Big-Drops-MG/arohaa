"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import type {
  InteractionLogData,
  InteractionLogEntry,
} from "@/features/data-export/model/interaction-log"

type LeadInteractionLogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  sessionId: string
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function formatLogDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z")
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatOffset(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${pad2(m)}:${pad2(s)}`
}

export function LeadInteractionLogDialog({
  open,
  onOpenChange,
  projectId,
  sessionId,
}: LeadInteractionLogDialogProps) {
  const [data, setData] = useState<InteractionLogData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState("")

  const fetchLog = useCallback(async () => {
    if (!sessionId || !projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const url = new URL(
        `/api/landing-pages/${encodeURIComponent(projectId)}/data-export/interaction-log`,
        window.location.origin
      )
      url.searchParams.set("session_id", sessionId)
      const res = await fetch(url.toString(), { cache: "no-store" })
      const body = (await res
        .json()
        .catch(() => ({}))) as InteractionLogData & {
        error?: string
      }
      if (!res.ok) {
        setError(body.error ?? "Could not load event log")
        setData(null)
        return
      }
      setData({
        sessionId: body.sessionId,
        startedAt: body.startedAt ?? null,
        entries: Array.isArray(body.entries) ? body.entries : [],
      })
    } catch {
      setError("Could not load event log")
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, sessionId])

  useEffect(() => {
    if (!open) return
    setQuery("")
    void fetchLog()
  }, [open, fetchLog])

  const filtered = useMemo(() => {
    const entries = data?.entries ?? []
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.message.toLowerCase().includes(q))
  }, [data?.entries, query])

  const timeOnFormMs = useMemo(() => {
    const entries = data?.entries ?? []
    if (entries.length === 0) return null
    let maxOffset = 0
    for (const entry of entries) {
      if (entry.offsetMs > maxOffset) maxOffset = entry.offsetMs
    }
    return maxOffset
  }, [data?.entries])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>Event log</DialogTitle>
              <DialogDescription>
                Review the timestamped user activity captured during the form
                session.
              </DialogDescription>
            </div>
            {timeOnFormMs != null ? (
              <div className="shrink-0 pt-0.5 text-right">
                <p className="text-xs font-medium text-muted-foreground">
                  Time on form
                </p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatOffset(timeOnFormMs)}
                </p>
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9"
            aria-label="Search event log"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="space-y-3 px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchLog()}
              >
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-muted-foreground">
              No events recorded for this session yet.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Date
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Timestamp
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Event
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry: InteractionLogEntry, index) => (
                  <tr
                    key={`${entry.at}-${entry.offsetMs}-${index}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-5 py-2 align-top whitespace-nowrap text-foreground tabular-nums">
                      {formatLogDate(entry.at)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-2 align-top font-medium whitespace-nowrap text-sky-700 tabular-nums"
                      )}
                    >
                      {formatOffset(entry.offsetMs)}
                    </td>
                    <td className="px-5 py-2 align-top break-words text-foreground">
                      {entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
