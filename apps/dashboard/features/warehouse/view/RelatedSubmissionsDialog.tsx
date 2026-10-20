"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

type RelatedRow = {
  landingPageId: string
  sessionId: string
  submittedAt: string
  utmSource: string
  firstName: string
  lastName: string
  emailMasked: string
  zip: string
  matchBasis: string
  matchDegree: string
  conflicts: string[]
  trustScore: number | null
  coverage: string
  reviewStatus: string
  decision: string
  callOutcome: string
}

type RelatedPayload = {
  status?: "ok" | "unavailable" | "no_keys" | "no_tenant"
  totalDirect: number
  totalIndirect: number
  truncated: boolean
  findings: Array<{ code: string; detail: string }>
  rows: RelatedRow[]
}

type HistoryEntry = {
  revision: number
  decision: string
  decision_note: string
  decision_by: string
  decision_at: string
  call_outcome: string
  call_outcome_by: string
  call_outcome_at: string
  updated_at: string
}

export function RelatedSubmissionsDialog({
  open,
  onOpenChange,
  workspaceId,
  sessionId,
  tenantWorkspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
}) {
  const [data, setData] = useState<RelatedPayload | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [expectedRevision, setExpectedRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState("")
  const [note, setNote] = useState("")
  const [outcome, setOutcome] = useState("")
  const [saving, setSaving] = useState(false)

  async function loadReviewState(
    tenant: string,
    cancelled?: () => boolean
  ): Promise<void> {
    const histParams = new URLSearchParams({
      tenantWorkspaceId: tenant,
      workspaceId,
      sessionId,
    })
    const [reviewRes, histRes] = await Promise.all([
      fetch(
        `/api/warehouse/review?${new URLSearchParams({
          tenantWorkspaceId: tenant,
          workspaceId,
          sessionId,
        })}`,
        { cache: "no-store" }
      ),
      fetch(`/api/warehouse/review/history?${histParams}`, {
        cache: "no-store",
      }),
    ])
    if (cancelled?.()) return
    if (reviewRes.ok) {
      const body = (await reviewRes.json()) as {
        review?: {
          revision?: number
          decision?: string
          decision_note?: string
          call_outcome?: string
        } | null
      }
      const review = body.review
      setExpectedRevision(
        review && Number.isFinite(Number(review.revision))
          ? Number(review.revision)
          : 0
      )
      if (review) {
        setDecision(review.decision || "")
        setNote(review.decision_note || "")
        setOutcome(review.call_outcome || "")
      }
    } else {
      setExpectedRevision(0)
    }
    if (histRes.ok) {
      const body = (await histRes.json()) as { history?: HistoryEntry[] }
      setHistory(Array.isArray(body.history) ? body.history : [])
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setData(null)
    setHistory([])
    setExpectedRevision(0)
    const params = new URLSearchParams({
      landingPageId: workspaceId,
      sessionId,
      lookbackDays: "30",
    })
    if (tenantWorkspaceId) {
      params.set("tenantWorkspaceId", tenantWorkspaceId)
    }
    void fetch(`/api/warehouse/related-submissions?${params}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as RelatedPayload
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load")
        }
      })

    if (tenantWorkspaceId) {
      void loadReviewState(tenantWorkspaceId, () => cancelled).catch(() => {
        /* optional */
      })
    }

    return () => {
      cancelled = true
    }
  }, [open, workspaceId, sessionId, tenantWorkspaceId])

  async function saveReview() {
    if (!tenantWorkspaceId) {
      setError("Organisation id missing; cannot save review")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/warehouse/review", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantWorkspaceId,
          workspaceId,
          sessionId,
          decision,
          decisionNote: note,
          callOutcome: outcome,
          reviewStatus: decision || outcome ? "reviewed" : "in_review",
          expectedRevision,
        }),
      })
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        await loadReviewState(tenantWorkspaceId)
        throw new Error(
          body.error ||
            "Review was updated elsewhere — form reloaded; review and save again"
        )
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as {
        review?: { revision?: number }
      }
      if (body.review && Number.isFinite(Number(body.review.revision))) {
        setExpectedRevision(Number(body.review.revision))
      }
      await loadReviewState(tenantWorkspaceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Related submissions</DialogTitle>
        </DialogHeader>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {!data && !error ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {data ? (
          <div className="space-y-4">
            {data.status && data.status !== "ok" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Matching status: {data.status}. Conflicts may be unknown — do
                not treat an empty list as proof of no related contacts.
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {data.totalDirect} direct
              {data.totalIndirect > 0
                ? `, ${data.totalIndirect} indirect`
                : ""}{" "}
              matches
              {data.truncated ? " (list truncated at shared fetch cap)" : ""}.
              Shared contacts do not imply one person. Evidence only —
              administrators decide.
            </p>
            {data.findings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {data.findings.map((f) => (
                  <li key={`${f.code}:${f.detail}`}>{f.detail}</li>
                ))}
              </ul>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Page</th>
                    <th className="py-2 pr-3">Partner</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">ZIP</th>
                    <th className="py-2 pr-3">Match</th>
                    <th className="py-2 pr-3">Degree</th>
                    <th className="py-2 pr-3">Conflicts</th>
                    <th className="py-2 pr-3">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={`${row.landingPageId}:${row.sessionId}`}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {row.submittedAt || "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {row.landingPageId.slice(0, 8)}…
                      </td>
                      <td className="py-2 pr-3">{row.utmSource || "—"}</td>
                      <td
                        className={
                          row.conflicts.includes("same_phone_different_names")
                            ? "bg-amber-50 py-2 pr-3"
                            : "py-2 pr-3"
                        }
                      >
                        {[row.firstName, row.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td
                        className={
                          row.conflicts.includes("same_phone_different_emails")
                            ? "bg-amber-50 py-2 pr-3"
                            : "py-2 pr-3"
                        }
                      >
                        {row.emailMasked || "—"}
                      </td>
                      <td
                        className={
                          row.conflicts.includes("contact_location_changed")
                            ? "bg-amber-50 py-2 pr-3"
                            : "py-2 pr-3"
                        }
                      >
                        {row.zip || "—"}
                      </td>
                      <td className="py-2 pr-3">{row.matchBasis}</td>
                      <td className="py-2 pr-3">{row.matchDegree}</td>
                      <td className="py-2 pr-3 text-xs">
                        {row.conflicts.join(", ") || "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {row.callOutcome || row.decision || row.reviewStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {history.length > 0 ? (
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-2 text-sm font-medium">Review history</h3>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {[...history].reverse().map((h) => (
                    <li key={`${h.revision}:${h.updated_at}`}>
                      rev {h.revision}: {h.decision || "—"} /{" "}
                      {h.call_outcome || "—"} by{" "}
                      {h.decision_by || h.call_outcome_by || "—"} at{" "}
                      {h.updated_at}
                      {h.decision_note ? ` — ${h.decision_note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Admin / CEO decision
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="accepted">Accepted</option>
                  <option value="follow_up_needed">Follow-up needed</option>
                  <option value="marked_duplicate">Marked duplicate</option>
                  <option value="marked_invalid">Marked invalid</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Call outcome
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="no_answer">No answer</option>
                  <option value="wrong_number">Wrong number</option>
                  <option value="never_requested">Never requested</option>
                  <option value="interested">Interested</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Notes
                </span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-border bg-background px-2 py-1.5"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Revision {expectedRevision} — concurrent edits are rejected;
                reload and retry if another reviewer saved first.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveReview()}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save review"}
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
