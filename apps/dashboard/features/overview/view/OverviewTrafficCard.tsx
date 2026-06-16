"use client"

import { Clock, Users } from "lucide-react"
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

type OverviewTrafficCardProps = {
  stats: OverviewTrafficStat[]
}

const trafficIcons = [Users, Clock] as const

export function OverviewTrafficCard({ stats }: OverviewTrafficCardProps) {
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
            Traffic
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "grid gap-3 sm:grid-cols-2",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          {stats.map((stat, index) => (
            <OverviewStatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={trafficIcons[index] ?? Users}
              index={index}
            />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}
