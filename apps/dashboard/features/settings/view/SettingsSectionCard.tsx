import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type SettingsSectionCardProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function SettingsSectionCard({
  title,
  description,
  children,
  className,
}: SettingsSectionCardProps) {
  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "h-full min-h-0 flex-col",
        className
      )}
    >
      <CardHeader className="gap-1 px-5 pt-0 pb-0 sm:px-6">
        <CardTitle
          className={cn(
            overviewSectionHeadingClassName,
            "text-base tracking-normal text-foreground normal-case"
          )}
        >
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-sm">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 sm:px-6">
        {children}
      </CardContent>
    </Card>
  )
}
