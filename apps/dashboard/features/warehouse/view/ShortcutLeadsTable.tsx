"use client"

import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { LeadRiskBadge } from "@/features/data-export/view/LeadRiskBadge"
import { LeadInteractionLogDialog } from "@/features/data-export/view/LeadInteractionLogDialog"
import {
  discoverVisibleLeadFieldKeys,
  humanizeLeadFieldLabel,
} from "@/features/data-export/model/lead-field-columns"
import type { WarehouseShortcutLead } from "@/lib/server/warehouse-load"
import {
  formatInDashboardTimezone,
  getDashboardTimezoneAbbreviation,
} from "@/lib/datetime"

const leadThClassName =
  "px-3 py-2.5 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
const leadTdClassName =
  "px-3 py-2.5 align-middle text-sm whitespace-nowrap text-foreground"

function cellValue(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  return trimmed || "—"
}

function shortId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "—"
  if (trimmed.length <= 12) return trimmed
  return `${trimmed.slice(0, 8)}…`
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

function shortcutLabel(lead: WarehouseShortcutLead): string {
  if (lead.usedCopy && lead.usedPaste) return "Copy + Paste"
  if (lead.usedCopy) return "Copy (Ctrl+C)"
  if (lead.usedPaste) return "Paste (Ctrl+V)"
  return "—"
}

export function ShortcutLeadsTable({
  rows,
}: {
  rows: WarehouseShortcutLead[]
}) {
  const [logLead, setLogLead] = useState<WarehouseShortcutLead | null>(null)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Copy/Paste shortcut users yet. Percentages need updated SDK traffic.
      </p>
    )
  }

  const fieldKeys = discoverVisibleLeadFieldKeys(rows)

  return (
    <>
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={leadThClassName}>#</th>
            <th className={leadThClassName}>When</th>
            <th className={leadThClassName}>Project</th>
            <th className={leadThClassName}>Shortcut</th>
            <th className={leadThClassName}>Event Log</th>
            <th className={leadThClassName}>Trust</th>
            <th className={leadThClassName}>First Name</th>
            <th className={leadThClassName}>Last Name</th>
            <th className={leadThClassName}>Email</th>
            <th className={leadThClassName}>Zip</th>
            <th className={leadThClassName}>UTM Source</th>
            <th className={leadThClassName}>UTM ID</th>
            <th className={leadThClassName}>TrustedForm</th>
            <th className={leadThClassName}>Form Submitted</th>
            {fieldKeys.map((key) => (
              <th key={key} className={leadThClassName}>
                {humanizeLeadFieldLabel(key)}
              </th>
            ))}
            <th className={leadThClassName}>MAC ID</th>
            <th className={leadThClassName}>Session</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead, index) => (
            <tr
              key={`${lead.workspaceId}:${lead.sessionId}`}
              className="border-b border-border/60 last:border-0"
            >
              <td
                className={cn(
                  leadTdClassName,
                  "text-muted-foreground tabular-nums"
                )}
              >
                {index + 1}
              </td>
              <td className={leadTdClassName}>{formatWhen(lead.createdAt)}</td>
              <td
                className={cn(
                  leadTdClassName,
                  "max-w-[16rem] whitespace-normal"
                )}
                title={lead.workspaceId}
              >
                {cellValue(lead.workspaceName || lead.lpPublicId)}
              </td>
              <td className={leadTdClassName}>{shortcutLabel(lead)}</td>
              <td className={leadTdClassName}>
                {lead.lpPublicId && lead.sessionId ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
                    onClick={() => setLogLead(lead)}
                  >
                    View log
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td className={leadTdClassName}>
                <LeadRiskBadge fraud={lead.fraud} />
              </td>
              <td className={leadTdClassName}>
                {cellValue(lead.firstName || lead.fields.first_name)}
              </td>
              <td className={leadTdClassName}>
                {cellValue(lead.lastName || lead.fields.last_name)}
              </td>
              <td className={leadTdClassName}>{cellValue(lead.email)}</td>
              <td className={leadTdClassName}>{cellValue(lead.zip)}</td>
              <td className={leadTdClassName}>{cellValue(lead.utmSource)}</td>
              <td className={leadTdClassName}>{cellValue(lead.utmId)}</td>
              <td
                className={cn(
                  leadTdClassName,
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
              <td className={leadTdClassName}>
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
                <td
                  key={key}
                  className={cn(
                    leadTdClassName,
                    "max-w-[14rem] whitespace-normal text-muted-foreground"
                  )}
                >
                  {cellValue(lead.fields[key])}
                </td>
              ))}
              <td
                className={cn(
                  leadTdClassName,
                  "font-mono text-xs text-muted-foreground"
                )}
              >
                {cellValue(lead.macId)}
              </td>
              <td
                className={cn(
                  leadTdClassName,
                  "font-mono text-xs text-muted-foreground"
                )}
                title={lead.sessionId}
              >
                {shortId(lead.sessionId)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <LeadInteractionLogDialog
        open={logLead != null}
        onOpenChange={(open) => {
          if (!open) setLogLead(null)
        }}
        projectId={logLead?.lpPublicId ?? ""}
        sessionId={logLead?.sessionId ?? ""}
        firstName={logLead?.firstName}
        lastName={logLead?.lastName}
        email={logLead?.email}
        fraud={logLead?.fraud}
      />
    </>
  )
}
