"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { FunnelFieldDropOff } from "@/features/funnel/model/funnel"
import { parseTrafficNumericValue } from "@/features/traffic/utils/sort-traffic-table-rows"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
import {
  trafficBreakdownCardContentClassName,
  trafficBreakdownCardShellClassName,
} from "@/features/traffic/view/traffic-card-layout"

type FunnelDropOffByFieldCardProps = {
  fields: FunnelFieldDropOff[]
  emptyMessage?: string
}

export function FunnelDropOffByFieldCard({
  fields,
  emptyMessage = "No drop-off data for this period.",
}: FunnelDropOffByFieldCardProps) {
  const reduceMotion = useReducedMotion()

  const rows = [...fields].sort(
    (a, b) =>
      parseTrafficNumericValue(b.dropOffs) -
      parseTrafficNumericValue(a.dropOffs)
  )

  return (
    <motion.div
      variants={overviewScaleIn}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="h-full min-h-0"
    >
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName,
          trafficBreakdownCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            Form Drop-Off by Field
          </CardTitle>
        </CardHeader>
        <CardContent className={trafficBreakdownCardContentClassName}>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[280px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground sm:px-6"
                  >
                    Field Name
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground sm:px-6"
                  >
                    Drop-offs
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground sm:px-6"
                  >
                    % Drop
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.fieldName}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-5 py-3 text-left font-medium text-foreground sm:px-6">
                        {row.fieldName}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums sm:px-6">
                        {row.dropOffs}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums sm:px-6">
                        {row.dropPercent}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
