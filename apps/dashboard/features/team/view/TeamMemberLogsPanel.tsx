"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Globe2,
  Loader2,
  MapPin,
  Monitor,
  RefreshCw,
  ScrollText,
  X,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { TeamActivityLogEntry } from "@/features/team/model/activity-log"
import {
  formatActivityEventType,
  formatActivityTabLabel,
  formatActivityTimestamp,
  groupActivityLogsByDate,
  shortenUserAgent,
} from "@/features/team/model/activity-log"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import type { TeamMember } from "@/features/team/model/team"

type TeamMemberLogsPanelProps = {
  member: TeamMember
  onClose: () => void
}

function eventTone(eventType: string): string {
  switch (eventType) {
    case "tab_view":
    case "page_view":
      return "bg-sky-50 text-sky-800 border-sky-200"
    case "button_click":
    case "nav_click":
      return "bg-violet-50 text-violet-800 border-violet-200"
    case "create":
    case "update":
    case "live_toggle":
    case "variant_link":
      return "bg-emerald-50 text-emerald-800 border-emerald-200"
    case "delete":
    case "archive":
    case "variant_unlink":
      return "bg-rose-50 text-rose-800 border-rose-200"
    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-200"
  }
}

export function TeamMemberLogsPanel({
  member,
  onClose,
}: TeamMemberLogsPanelProps) {
  const [items, setItems] = useState<TeamActivityLogEntry[]>([])
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
        items?: TeamActivityLogEntry[]
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

  const grouped = groupActivityLogsByDate(items)

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
                Pages, tabs, clicks, and project actions
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
              data-activity-ignore="true"
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
              data-activity-ignore="true"
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
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              Tab visits, button clicks, navigation, and project changes will
              appear here.
            </p>
          </div>
        ) : null}

        {grouped.length > 0 ? (
          <div className="scrollbar-minimal max-h-[min(70vh,720px)] space-y-5 overflow-y-auto pr-1">
            {grouped.map((group) => (
              <div key={group.dateLabel} className="space-y-2.5">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.dateLabel}
                </h3>
                <ol className="space-y-2">
                  {group.items.map((entry) => {
                    const tabLabel = formatActivityTabLabel(entry.tab)
                    const browser = shortenUserAgent(entry.userAgent)
                    return (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-border px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                eventTone(entry.eventType)
                              )}
                            >
                              {formatActivityEventType(entry.eventType)}
                            </span>
                            <p className="text-sm font-medium text-foreground">
                              {entry.summary}
                            </p>
                          </div>
                          <time
                            dateTime={entry.createdAt}
                            className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                          >
                            {formatActivityTimestamp(entry.createdAt)}
                          </time>
                        </div>

                        {entry.detail && entry.detail !== "—" ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {entry.detail}
                          </p>
                        ) : null}

                        <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                          {entry.projectName || entry.projectPublicId ? (
                            <p className="flex items-center gap-1.5 truncate">
                              <MapPin className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">
                                Project:{" "}
                                {entry.projectName || entry.projectPublicId}
                              </span>
                            </p>
                          ) : null}
                          {tabLabel ? (
                            <p className="truncate">Tab: {tabLabel}</p>
                          ) : null}
                          {entry.path ? (
                            <p className="flex items-start gap-1.5">
                              <Globe2
                                className="mt-0.5 size-3 shrink-0"
                                aria-hidden
                              />
                              <span className="break-all">{entry.path}</span>
                            </p>
                          ) : null}
                          {entry.targetLabel ? (
                            <p className="truncate">
                              Control: {entry.targetLabel}
                              {entry.targetHref ? ` → ${entry.targetHref}` : ""}
                            </p>
                          ) : null}
                          <p className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
                            <Monitor className="size-3 shrink-0" aria-hidden />
                            <span>
                              IP:{" "}
                              {entry.ipAddress
                                ? entry.ipAddress === "127.0.0.1"
                                  ? "127.0.0.1 (local)"
                                  : entry.ipAddress
                                : "Not recorded"}
                            </span>
                            {browser ? (
                              <span className="font-normal text-muted-foreground">
                                · {browser}
                              </span>
                            ) : null}
                          </p>
                        </div>
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
