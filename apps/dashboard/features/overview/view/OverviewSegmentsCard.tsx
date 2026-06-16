"use client"

import { CalendarDays, MapPin } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"
import { overviewScaleIn } from "@/features/overview/view/overview-motion"
import { OverviewStatTile } from "@/features/overview/view/OverviewStatTile"
import type { OverviewTrafficStat } from "@/features/overview/model/overview"

type OverviewSegmentsCardProps = {
  segments: OverviewTrafficStat[]
}

const segmentIcons = [MapPin, CalendarDays] as const

export function OverviewSegmentsCard({ segments }: OverviewSegmentsCardProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      variants={overviewScaleIn}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
    >
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <CardTitle className={overviewSectionHeadingClassName}>
            Segments
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "grid gap-3 sm:grid-cols-2",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          {segments.map((segment, index) => (
            <OverviewStatTile
              key={segment.label}
              label={segment.label}
              value={segment.value}
              icon={segmentIcons[index] ?? MapPin}
              index={index}
            />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}
