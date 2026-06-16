"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { EventTrackingSubmissionRow } from "@/features/event-tracking/model/event-tracking"
import {
  eventTrackingSubmissionColumnLabels,
  eventTrackingSubmissionOverTimeTitle,
} from "@/features/event-tracking/utils/event-tracking-segment-labels"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  eventTrackingDetailCardContentClassName,
  eventTrackingDetailCardShellClassName,
} from "@/features/event-tracking/view/event-tracking-card-layout"

type EventTrackingSubmissionOverTimeCardProps = {
  formType: OverviewLandingFormType
  rows: EventTrackingSubmissionRow[]
  emptyMessage?: string
  expandable?: boolean
  previewRowLimit?: number
}

function EventTrackingSubmissionTable({
  formType,
  rows,
  emptyMessage,
}: {
  formType: OverviewLandingFormType
  rows: EventTrackingSubmissionRow[]
  emptyMessage: string
}) {
  const columns = eventTrackingSubmissionColumnLabels(formType)

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground sm:px-6"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground sm:px-6"
            >
              {columns.formSubmitted}
            </th>
            <th
              scope="col"
              className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground sm:px-6"
            >
              {columns.share}
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
                key={row.date}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-5 py-3 text-left font-medium text-foreground sm:px-6">
                  {row.date}
                </td>
                <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums sm:px-6">
                  {row.formSubmitted}
                </td>
                <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums sm:px-6">
                  {row.share ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function EventTrackingSubmissionOverTimeCardBody({
  formType,
  rows,
  emptyMessage = "No submission data for this period.",
}: EventTrackingSubmissionOverTimeCardProps) {
  const reduceMotion = useReducedMotion()
  const title = eventTrackingSubmissionOverTimeTitle(formType)

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
          eventTrackingDetailCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={eventTrackingDetailCardContentClassName}>
          <EventTrackingSubmissionTable
            formType={formType}
            rows={rows}
            emptyMessage={emptyMessage}
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function EventTrackingSubmissionOverTimeCard({
  formType,
  rows,
  emptyMessage = "No submission data for this period.",
  expandable = false,
  previewRowLimit,
}: EventTrackingSubmissionOverTimeCardProps) {
  const title = eventTrackingSubmissionOverTimeTitle(formType)
  const previewRows =
    previewRowLimit != null ? rows.slice(0, previewRowLimit) : rows

  const body = (
    <EventTrackingSubmissionOverTimeCardBody
      formType={formType}
      rows={previewRows}
      emptyMessage={emptyMessage}
    />
  )

  if (!expandable) {
    return body
  }

  return (
    <TrafficExpandableCard
      title={title}
      className="h-full min-h-0"
      dialogClassName="max-w-3xl"
      expandedContent={
        <EventTrackingSubmissionTable
          formType={formType}
          rows={rows}
          emptyMessage={emptyMessage}
        />
      }
    >
      {body}
    </TrafficExpandableCard>
  )
}
