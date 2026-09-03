"use client"

import { Lock } from "lucide-react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { IntelligenceCenterPayload } from "@/features/data-lab/model/intelligence"
import { IntelligenceCenter } from "@/features/data-lab/view/IntelligenceCenter"
import {
  overviewAnalyticCardContentPaddingClassName,
  overviewAnalyticCardShellClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type Level3PanelProps = {
  data: IntelligenceCenterPayload | null
  isLoading: boolean
  canAccess?: boolean
}

export function Level3Panel({
  data,
  isLoading,
  canAccess = true,
}: Level3PanelProps) {
  if (!canAccess) {
    return (
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardContent
          className={cn(
            "flex min-h-60 flex-col items-center justify-center gap-3 text-center",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shadow-xs">
            <Lock className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Level 3 stats are restricted
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Level 3 Data Lab insights combine multiple lead dimensions and
              require approved operator access.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (
    !isLoading &&
    (!data ||
      (data.winners.length === 0 &&
        data.boards.length === 0 &&
        data.actions.length === 0))
  ) {
    return (
      <Card
        className={cn(
          overviewCardPointerFocusResetClassName,
          overviewAnalyticCardShellClassName
        )}
      >
        <CardContent
          className={cn(
            "flex min-h-60 flex-col items-center justify-center text-center",
            overviewAnalyticCardContentPaddingClassName
          )}
        >
          <p className="text-sm font-medium text-foreground">Level 3</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Not enough combination data is available for this landing page yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return <IntelligenceCenter data={data} isLoading={isLoading} />
}
