"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
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
import {
  formatInteractionLogMessage,
  formatInteractionOffset,
  formatInteractionWhen,
  interactionLogKindLabel,
  resolveInteractionLogKind,
} from "@/features/data-export/model/format-interaction-log"
import type {
  InteractionLogData,
  InteractionLogEntry,
  LeadFraudAssessment,
} from "@/features/data-export/model/interaction-log"
import { LeadRiskBadge } from "@/features/data-export/view/LeadRiskBadge"

type LeadInteractionLogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  sessionId: string
  firstName?: string
  lastName?: string
  email?: string
  fraud?: LeadFraudAssessment | null
}

function kindBadgeClass(kind: number | null): string {
  switch (resolveInteractionLogKind(kind)) {
    case "typed":
      return "bg-sky-50 text-sky-700 ring-sky-100"
    case "pressed":
      return "bg-violet-50 text-violet-700 ring-violet-100"
    case "clicked":
      return "bg-amber-50 text-amber-800 ring-amber-100"
    case "changed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100"
    case "selected":
      return "bg-teal-50 text-teal-700 ring-teal-100"
    case "lifecycle":
      return "bg-neutral-100 text-neutral-700 ring-neutral-200"
    default:
      return "bg-neutral-100 text-neutral-600 ring-neutral-200"
  }
}

function kindDotClass(kind: number | null): string {
  switch (resolveInteractionLogKind(kind)) {
    case "typed":
      return "bg-sky-500"
    case "pressed":
      return "bg-violet-500"
    case "clicked":
      return "bg-amber-500"
    case "changed":
      return "bg-emerald-500"
    case "selected":
      return "bg-teal-500"
    case "lifecycle":
      return "bg-neutral-500"
    default:
      return "bg-neutral-400"
  }
}

function displayLeadName(input: {
  firstName?: string
  lastName?: string
  email?: string
}): string {
  const name = [input.firstName?.trim(), input.lastName?.trim()]
    .filter(Boolean)
    .join(" ")
  if (name) return name
  if (input.email?.trim()) return input.email.trim()
  return "Unknown lead"
}

function MetaItem({
  label,
  value,
  mono,
  nowrap,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  nowrap?: boolean
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm leading-snug font-medium text-foreground",
          mono && "tabular-nums",
          nowrap ? "whitespace-nowrap" : "wrap-break-word"
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}

export function LeadInteractionLogDialog({
  open,
  onOpenChange,
  projectId,
  sessionId,
  firstName: firstNameProp,
  lastName: lastNameProp,
  email: emailProp,
  fraud: fraudProp,
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
        formId: body.formId ?? null,
        firstName: body.firstName ?? "",
        lastName: body.lastName ?? "",
        email: body.email ?? "",
        fraud: body.fraud ?? null,
        entries: Array.isArray(body.entries)
          ? body.entries.map((entry) => ({
              at: entry.at,
              offsetMs: entry.offsetMs,
              message: entry.message,
              kind: entry.kind ?? null,
            }))
          : [],
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

  const firstName = firstNameProp?.trim() || data?.firstName || ""
  const lastName = lastNameProp?.trim() || data?.lastName || ""
  const email = emailProp?.trim() || data?.email || ""
  const fraud = fraudProp ?? data?.fraud ?? null
  const leadTitle = displayLeadName({ firstName, lastName, email })
  const showEmailSubtitle = Boolean(email) && leadTitle !== email

  const displayEntries = useMemo(() => {
    const entries = data?.entries ?? []
    return entries.map((entry) => {
      const readable = formatInteractionLogMessage(entry.message)
      return { entry, readable }
    })
  }, [data?.entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return displayEntries
    return displayEntries.filter(({ entry, readable }) => {
      const kindLabel = interactionLogKindLabel(entry.kind).toLowerCase()
      return (
        readable.toLowerCase().includes(q) ||
        entry.message.toLowerCase().includes(q) ||
        kindLabel.includes(q)
      )
    })
  }, [displayEntries, query])

  const timeOnFormMs = useMemo(() => {
    const entries = data?.entries ?? []
    if (entries.length === 0) return null
    let maxOffset = 0
    for (const entry of entries) {
      if (entry.offsetMs > maxOffset) maxOffset = entry.offsetMs
    }
    return maxOffset
  }, [data?.entries])

  const totalEvents = data?.entries?.length ?? 0
  const showingFiltered =
    Boolean(query.trim()) && filtered.length !== totalEvents
  const startedValue = data?.startedAt
    ? formatInteractionWhen(data.startedAt)
    : isLoading
      ? "…"
      : "—"
  const durationValue =
    timeOnFormMs != null
      ? formatInteractionOffset(timeOnFormMs)
      : isLoading
        ? "…"
        : "—"
  const eventsValue = isLoading ? "…" : String(totalEvents)
  const formValue = data?.formId?.trim() || (isLoading ? "…" : "—")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,800px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-6 pt-5 pr-12 pb-4 text-left">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Event log
          </p>
          <div className="mt-1.5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl leading-tight">
                {leadTitle}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {showEmailSubtitle ? (
                  <span className="block truncate text-sm text-muted-foreground">
                    {email}
                  </span>
                ) : (
                  <span className="sr-only">
                    Timestamped form activity for this lead session
                  </span>
                )}
              </DialogDescription>
            </div>
            <LeadRiskBadge fraud={fraud} className="mt-0.5 shrink-0 text-sm" />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-[minmax(14rem,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <MetaItem
              label="Started"
              value={startedValue}
              mono
              nowrap
              className="col-span-2 sm:col-span-1"
            />
            <MetaItem label="Duration" value={durationValue} mono />
            <MetaItem label="Events" value={eventsValue} mono />
            {formValue !== "—" ? (
              <MetaItem label="Form" value={formValue} />
            ) : null}
          </dl>

          {fraud?.reasons?.length ? (
            <div className="mt-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Trust signals
              </p>
              <ul className="mt-1.5 max-h-20 space-y-1 overflow-auto text-xs leading-relaxed text-muted-foreground">
                {fraud.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-400"
                      aria-hidden
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-6 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search field, value, or event type"
              className="h-9 pl-9"
              aria-label="Search event log"
            />
          </div>
          {!isLoading && !error && totalEvents > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {showingFiltered ? (
                <>
                  Showing{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {filtered.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {totalEvents}
                  </span>{" "}
                  events
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground tabular-nums">
                    {totalEvents}
                  </span>{" "}
                  {totalEvents === 1 ? "event" : "events"} in session order
                </>
              )}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading event log…
            </div>
          ) : error ? (
            <div className="space-y-3 px-6 py-16 text-center">
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
            <p className="px-6 py-20 text-center text-sm text-muted-foreground">
              {query.trim()
                ? "No events match your search."
                : "No events recorded for this session yet."}
            </p>
          ) : (
            <ol className="px-6 py-4">
              {filtered.map(
                (
                  {
                    entry,
                    readable,
                  }: { entry: InteractionLogEntry; readable: string },
                  index
                ) => {
                  const isLast = index === filtered.length - 1
                  return (
                    <li
                      key={`${entry.at}-${entry.offsetMs}-${index}`}
                      className="relative flex gap-4"
                    >
                      <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatInteractionOffset(entry.offsetMs)}
                        </span>
                      </div>

                      <div className="relative flex w-4 shrink-0 justify-center">
                        {!isLast ? (
                          <span
                            className="absolute top-3 bottom-0 w-px bg-border"
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className={cn(
                            "relative z-10 mt-1.5 size-2.5 rounded-full ring-4 ring-background",
                            kindDotClass(entry.kind)
                          )}
                          aria-hidden
                        />
                      </div>

                      <div
                        className={cn("min-w-0 flex-1 pb-5", isLast && "pb-1")}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                              kindBadgeClass(entry.kind)
                            )}
                          >
                            {interactionLogKindLabel(entry.kind)}
                          </span>
                          <time
                            className="text-[11px] text-muted-foreground tabular-nums"
                            dateTime={entry.at}
                          >
                            {formatInteractionWhen(entry.at)}
                          </time>
                        </div>
                        <p className="mt-1.5 text-sm leading-snug wrap-break-word text-foreground">
                          {readable}
                        </p>
                      </div>
                    </li>
                  )
                }
              )}
            </ol>
          )}
        </div>

        {sessionId ? (
          <div className="shrink-0 border-t border-border bg-muted/20 px-6 py-2.5">
            <p className="truncate text-[11px] text-muted-foreground">
              Session{" "}
              <span className="font-mono text-foreground/80">{sessionId}</span>
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
