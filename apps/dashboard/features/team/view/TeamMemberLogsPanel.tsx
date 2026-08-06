"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ScrollText, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { LandingPageAuditLogEntry } from "@/features/settings/model/landing-page-audit-log"
import {
  formatAuditLogAction,
  formatAuditLogDetail,
  formatAuditLogTimestamp,
  groupAuditLogsByDate,
} from "@/features/settings/utils/audit-log-format"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import type { TeamMember } from "@/features/team/model/team"

type TeamMemberLogEntry = LandingPageAuditLogEntry & {
  landingPageBrandName?: string | null
  landingPagePublicId?: string | null
}

type TeamMemberLogsPanelProps = {
  member: TeamMember
  onClose: () => void
}

export function TeamMemberLogsPanel({
  member,
  onClose,
}: TeamMemberLogsPanelProps) {
  const [items, setItems] = useState<TeamMemberLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/team/members/${encodeURIComponent(member.id)}/logs`,
        { cache: "no-store" }
      )
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        items?: TeamMemberLogEntry[]
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
  }, [member.id])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const grouped = groupAuditLogsByDate(items)

  return (
    <SettingsSectionCard title="Activity logs" className="lg:sticky lg:top-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">
              {member.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {member.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {member.email || "—"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => void fetchLogs()}
              disabled={isLoading}
              aria-label="Refresh logs"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onClose}
              aria-label="Close logs"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading && items.length === 0 ? (
          <div
            className="space-y-3 py-2"
            aria-busy
            aria-label="Loading activity log"
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="h-3.5 w-2/3 animate-pulse rounded-md bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && items.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ScrollText
              className="size-5 text-muted-foreground/70"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              No activity recorded for this member yet.
            </p>
          </div>
        ) : null}

        {grouped.length > 0 ? (
          <div className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto pr-1">
            {grouped.map((group) => (
              <div key={group.dateLabel} className="space-y-2.5">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.dateLabel}
                </h3>
                <ol className="space-y-2">
                  {group.items.map((entry) => {
                    const projectName =
                      "landingPageBrandName" in entry &&
                      typeof entry.landingPageBrandName === "string"
                        ? entry.landingPageBrandName
                        : null
                    return (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-border px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {formatAuditLogAction(entry.action)}
                          </p>
                          <time
                            dateTime={entry.createdAt}
                            className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                          >
                            {formatAuditLogTimestamp(entry.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatAuditLogDetail(entry)}
                        </p>
                        {projectName ? (
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            Project: {projectName}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </SettingsSectionCard>
  )
}
