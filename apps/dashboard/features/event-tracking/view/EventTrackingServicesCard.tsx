"use client"

import type { EventTrackingServiceRow } from "@/features/event-tracking/model/event-tracking"
import { cn } from "@workspace/ui/lib/utils"

type EventTrackingServicesCardProps = {
  rows: EventTrackingServiceRow[]
  className?: string
}

export function EventTrackingServicesCard({
  rows,
  className,
}: EventTrackingServicesCardProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-xs",
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">
          Services / verticals
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clicks from this hub into each configured service.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No services configured yet. Add them in Settings, then mark service
          links with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
            data-arohaa-service
          </code>
          .
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pr-3 pb-2 font-medium">Service</th>
                <th className="pr-3 pb-2 font-medium">Id</th>
                <th className="pb-2 text-right font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.serviceId}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="py-2.5 pr-3 font-medium text-foreground">
                    {row.serviceLabel}
                    {row.href ? (
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                        {row.href}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                    {row.serviceId}
                  </td>
                  <td className="py-2.5 text-right text-foreground tabular-nums">
                    {row.clicks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
