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
  totalDirect: number
  truncated: boolean
  findings: Array<{ code: string; detail: string }>
  rows: RelatedRow[]
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
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState("")
  const [note, setNote] = useState("")
  const [outcome, setOutcome] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setData(null)
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
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
            <p className="text-sm text-muted-foreground">
              {data.totalDirect} direct matches
              {data.truncated ? " (list truncated)" : ""}. Evidence only —
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
