"use client"

import { useMemo, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { SeoContentItem } from "@/features/seo/model/seo"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"
import { overviewCardPointerFocusResetClassName } from "@/features/overview/view/overview-focus-styles"

type ContentTab = "top" | "up" | "down"

type SeoContentPanelProps = {
  items: SeoContentItem[]
  metricLabel: string
}

export function SeoContentPanel({ items, metricLabel }: SeoContentPanelProps) {
  const [tab, setTab] = useState<ContentTab>("top")

  const visible = useMemo(() => {
    if (tab === "top") {
      return [...items].sort((a, b) => b.clicks - a.clicks).slice(0, 10)
    }
    if (tab === "up") {
      return [...items]
        .filter((item) => (item.changePct ?? 0) > 0)
        .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
        .slice(0, 10)
    }
    return [...items]
      .filter((item) => (item.changePct ?? 0) < 0)
      .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))
      .slice(0, 10)
  }, [items, tab])

  return (
    <Card
      className={cn(
        overviewCardPointerFocusResetClassName,
        overviewAnalyticCardShellClassName,
        "max-w-none gap-0 py-0"
      )}
    >
      <CardHeader className={overviewAnalyticCardHeaderClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className={overviewSectionHeadingClassName}>
            Your content
          </CardTitle>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(
              [
                ["top", "Top"],
                ["up", "Trending up"],
                ["down", "Trending down"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  tab === id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_auto] border-b border-border px-5 py-2.5 text-sm font-medium text-muted-foreground sm:px-6">
          <span>Page</span>
          <span>{metricLabel}</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
            No content trends for this date range.
          </p>
        ) : (
          visible.map((item, index) => (
            <div
              key={`${item.pageUrl}:${index}`}
              className={cn(
                "grid grid-cols-[1fr_auto] items-start gap-4 px-5 py-3 sm:px-6",
                index < visible.length - 1 && "border-b border-border/60"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.pageTitle}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.pageUrl}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {item.clicks.toLocaleString("en-US")}
                </p>
                {item.changePct != null ? (
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      item.changePct < 0
                        ? "text-red-600"
                        : item.changePct > 0
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {item.changePct > 0 ? "+" : ""}
                    {item.changePct}%
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
