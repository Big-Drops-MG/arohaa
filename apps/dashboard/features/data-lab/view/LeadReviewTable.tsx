"use client"

import { useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import type { LeadFraudAssessment } from "@/features/data-export/model/interaction-log"
import {
  discoverVisibleLeadFieldKeys,
  humanizeLeadFieldLabel,
  sortLeadFieldKeys,
} from "@/features/data-export/model/lead-field-columns"
import { LeadInteractionLogDialog } from "@/features/data-export/view/LeadInteractionLogDialog"
import { LeadRiskBadge } from "@/features/data-export/view/LeadRiskBadge"
import { buildBehaviorTitle } from "@/features/data-export/view/LeadBehaviorBadge"
import { SessionEvidenceDialog } from "@/features/warehouse/view/SessionEvidenceDialog"
import {
  leadSourceDetail,
  leadSourceLabel,
  pasteActivityLabel,
} from "@/features/data-lab/model/lead-review"
import {
  formatInDashboardTimezone,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

const thClassName =
  "px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground"
const tdClassName =
  "px-4 py-3 align-middle text-sm whitespace-nowrap text-foreground"

function cellValue(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  return trimmed || "—"
}

function formatWhen(value: string): string {
  if (!value) return "—"
  const d = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z"
  )
  if (Number.isNaN(d.getTime())) return value
  const formatted = formatInDashboardTimezone(d, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
  return `${formatted} ${getDashboardTimezoneAbbreviation(d)}`
}

export function LeadReviewTable({
  rows,
  projectId,
  pageOffset = 0,
  emptyMessage,
}: {
  rows: DataExportLeadRow[]
  projectId: string
  pageOffset?: number
  emptyMessage?: string
}) {
  const [logLead, setLogLead] = useState<{
    sessionId: string
    firstName: string
    lastName: string
    email: string
    fraud: LeadFraudAssessment | null
  } | null>(null)
  const [evidenceSessionId, setEvidenceSessionId] = useState<string | null>(
    null
  )
  const [showPii, setShowPii] = useState(false)

  const fieldKeys = useMemo(
    () => sortLeadFieldKeys(discoverVisibleLeadFieldKeys(rows)),
    [rows]
  )

  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "No leads to review for this filter and range."}
      </p>
    )
  }

  return (
    <>
      <div className="flex items-center justify-end border-b border-border px-4 py-2.5">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showPii}
            onChange={(e) => setShowPii(e.target.checked)}
            className="rounded border-border"
          />
          Show full email
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={thClassName}>#</th>
              <th className={thClassName}>When</th>
              <th className={thClassName}>Paste</th>
              <th className={thClassName}>Event log</th>
              <th className={thClassName}>Trust score</th>
              <th className={thClassName}>Session</th>
              <th className={thClassName}>First name</th>
              <th className={thClassName}>Last name</th>
              <th className={thClassName}>Email</th>
              <th className={thClassName}>Zip</th>
              <th className={thClassName}>IP</th>
              <th className={thClassName}>Source</th>
              <th className={thClassName}>UTM ID</th>
              <th className={thClassName}>TrustedForm</th>
              <th className={thClassName}>Submitted</th>
              {fieldKeys.map((key) => (
                <th key={key} className={thClassName}>
                  {humanizeLeadFieldLabel(key)}
                </th>
              ))}
              <th className={thClassName}>Fingerprint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead, index) => (
              <tr
                key={`${lead.sessionId}-${lead.createdAt}`}
                className="border-b border-border last:border-b-0 hover:bg-muted/20"
              >
                <td
                  className={cn(
                    tdClassName,
                    "text-muted-foreground tabular-nums"
                  )}
                >
                  {pageOffset + index + 1}
                </td>
                <td className={tdClassName}>{formatWhen(lead.createdAt)}</td>
                <td className={tdClassName}>{pasteActivityLabel(lead)}</td>
                <td className={tdClassName}>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-sm font-medium text-sky-700"
                    onClick={() =>
                      setLogLead({
                        sessionId: lead.sessionId,
                        firstName: lead.fields.first_name ?? "",
                        lastName: lead.fields.last_name ?? "",
                        email: lead.email,
                        fraud: lead.fraud,
                      })
                    }
                  >
                    View log
                  </Button>
                </td>
                <td className={tdClassName}>
                  <LeadRiskBadge fraud={lead.fraud} />
                </td>
                <td className={tdClassName}>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 font-mono text-xs font-medium text-sky-700"
                    title={
                      lead.behavior
                        ? buildBehaviorTitle(lead.behavior)
                        : "Open session evidence"
                    }
                    onClick={() => setEvidenceSessionId(lead.sessionId)}
                  >
                    Session
                  </Button>
                </td>
                <td className={tdClassName}>
                  {cellValue(lead.fields.first_name)}
                </td>
                <td className={tdClassName}>
                  {cellValue(lead.fields.last_name)}
                </td>
                <td className={tdClassName}>
                  {cellValue(
                    showPii
                      ? lead.email
                      : lead.email
                        ? `${lead.email.slice(0, 2)}•••@${lead.email.split("@")[1] ?? "…"}`
                        : ""
                  )}
                </td>
                <td className={tdClassName}>{cellValue(lead.zip)}</td>
                <td
                  className={cn(
                    tdClassName,
                    "font-mono text-xs text-muted-foreground"
                  )}
                >
                  {cellValue(lead.clientIp)}
                </td>
                <td
                  className={cn(tdClassName, "max-w-[12rem] whitespace-normal")}
                  title={leadSourceDetail(lead) || undefined}
                >
                  {leadSourceLabel(lead)}
                </td>
                <td className={tdClassName}>{cellValue(lead.utmId)}</td>
                <td
                  className={cn(
                    tdClassName,
                    "max-w-[12rem] min-w-[8rem] whitespace-normal"
                  )}
                >
                  {lead.trustedFormUrl ? (
                    <a
                      href={lead.trustedFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium break-all text-sky-700 underline-offset-2 hover:underline"
                    >
                      View certificate
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={tdClassName}>
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                      lead.formSubmitted
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {lead.formSubmitted ? "Yes" : "No"}
                  </span>
                </td>
                {fieldKeys.map((key) => (
                  <td key={key} className={tdClassName}>
                    {cellValue(lead.fields[key])}
                  </td>
                ))}
                <td
                  className={cn(
                    tdClassName,
                    "font-mono text-xs text-muted-foreground"
                  )}
                >
                  {cellValue(lead.macId)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeadInteractionLogDialog
        open={logLead != null}
        onOpenChange={(open) => {
          if (!open) setLogLead(null)
        }}
        projectId={projectId}
        sessionId={logLead?.sessionId ?? ""}
        firstName={logLead?.firstName}
        lastName={logLead?.lastName}
        email={logLead?.email}
        fraud={logLead?.fraud}
      />
      <SessionEvidenceDialog
        open={evidenceSessionId != null}
        onOpenChange={(open) => {
          if (!open) setEvidenceSessionId(null)
        }}
        workspaceId=""
        sessionId={evidenceSessionId ?? ""}
        endpoint={`/api/landing-pages/${encodeURIComponent(projectId)}/data-export/session-evidence`}
      />
    </>
  )
}
