"use client"

import { Lock } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  LEAD_QUALITY_ATTRIBUTES,
  formatLeadQualityPercent,
  type LeadQualityRow,
} from "@/features/data-lab/model/lead-quality"
import { overviewSectionHeadingClassName } from "@/features/overview/view/overview-card-density"

type LeadQualityPanelProps = {
  rows: LeadQualityRow[]
  isLoading: boolean
  canAccess?: boolean
}

export function LeadQualityPanel({
  rows,
  isLoading,
  canAccess = true,
}: LeadQualityPanelProps) {
  if (!canAccess) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center">
        <Lock className="size-5 text-neutral-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Lead quality is restricted
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Lead quality breakdowns are only available to approved operators.
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className={overviewSectionHeadingClassName}>Lead quality</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share of leads from each UTM source that match each quality attribute
          for this landing page.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                >
                  UTM Source
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground"
                >
                  Total leads
                </th>
                {LEAD_QUALITY_ATTRIBUTES.map((attr) => (
                  <th
                    key={attr.id}
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground"
                  >
                    {attr.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr
                    key={`skeleton-${index}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
                    </td>
                    {LEAD_QUALITY_ATTRIBUTES.map((attr) => (
                      <td key={attr.id} className="px-4 py-3">
                        <div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + LEAD_QUALITY_ATTRIBUTES.length}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No leads in this range to score quality attributes.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.utmSource}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.utmSource}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      {row.totalLeads.toLocaleString()}
                    </td>
                    {LEAD_QUALITY_ATTRIBUTES.map((attr) => (
                      <td
                        key={attr.id}
                        className={cn(
                          "px-4 py-3 text-right font-medium tabular-nums",
                          row.rates[attr.id] > 0
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatLeadQualityPercent(row.rates[attr.id])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
