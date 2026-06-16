"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { LandingPageAuditLogEntry } from "@/features/settings/model/landing-page-audit-log"
import {
  formatAuditLogAction,
  formatAuditLogActor,
  formatAuditLogDetail,
  formatAuditLogTimestamp,
  groupAuditLogsByDate,
} from "@/features/settings/utils/audit-log-format"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"

type SettingsActivityLogSectionProps = {
  publicId: string
  isActive: boolean
}

export function SettingsActivityLogSection({
  publicId,
  isActive,
}: SettingsActivityLogSectionProps) {
  const [items, setItems] = useState<LandingPageAuditLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(publicId)}/logs`,
        { cache: "no-store" }
      )
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        items?: LandingPageAuditLogEntry[]
      }

      if (!res.ok || !Array.isArray(data.items)) {
        setError(data.error ?? "Could not load activity log")
        setItems([])
        return
      }

      setItems(data.items)
    } finally {
      setIsLoading(false)
    }
  }, [publicId])

  useEffect(() => {
    if (!isActive) return
    void fetchLogs()
  }, [fetchLogs, isActive])

  const grouped = groupAuditLogsByDate(items)

  return (
    <SettingsSectionCard
      title="Activity log"
      description="A complete audit trail of changes and checks for this project."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {items.length} event{items.length === 1 ? "" : "s"} recorded
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchLogs()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Refreshing
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 size-4" aria-hidden />
                Refresh
              </>
            )}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading activity log
          </div>
        ) : null}

        {!isLoading && items.length === 0 && !error ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : null}

        {grouped.length > 0 ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.dateLabel} className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.dateLabel}
                </h3>
                <ol className="space-y-2">
                  {group.items.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {formatAuditLogAction(entry.action)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatAuditLogDetail(entry)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatAuditLogActor(entry)}
                          </p>
                        </div>
                        <time
                          dateTime={entry.createdAt}
                          className="shrink-0 text-xs text-muted-foreground tabular-nums"
                        >
                          {formatAuditLogTimestamp(entry.createdAt)}
                        </time>
                      </div>
                      {entry.traceId ? (
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          Trace: {entry.traceId}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SettingsSectionCard>
  )
}
