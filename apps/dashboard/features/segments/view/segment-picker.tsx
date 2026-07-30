"use client"

import { useEffect, useState } from "react"
import { Check, ChevronDown, Users } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { overviewSelectTriggerClassName } from "@/features/overview/view/overview-select-styles"
import type { SavedSegment } from "@/features/segments/model/segment-model"
import { fetchSavedSegments } from "@/features/segments/controller/segment-controller"

const ALL_SEGMENTS_LABEL = "All segments"

export function SegmentPicker({ projectId }: { projectId: string }) {
  const { segmentId, setSegmentId, clearSegmentFilter } =
    useDashboardSegmentFilter()
  const [open, setOpen] = useState(false)
  const [segments, setSegments] = useState<SavedSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load once on mount so the trigger can name an already-applied segment,
  // then refresh whenever the popover is opened.
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)

    fetchSavedSegments(projectId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSegments(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSegments([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [projectId, open])

  const activeSegment = segments.find((segment) => segment.id === segmentId)
  const label = activeSegment ? activeSegment.name : ALL_SEGMENTS_LABEL

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            overviewSelectTriggerClassName,
            "inline-flex w-full max-w-full items-center justify-between sm:w-auto sm:max-w-64 sm:min-w-44",
            segmentId && "border-neutral-300 bg-neutral-100 text-neutral-900"
          )}
          aria-label="Segment filter"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Users className="size-3.5 shrink-0 text-neutral-500" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-neutral-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(100vw-2rem,17rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white p-0 text-neutral-900 shadow-lg ring-1 shadow-neutral-950/8 ring-black/5"
      >
        <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
          Segments
        </div>

        <div className="flex max-h-80 flex-col overflow-y-auto pb-1">
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100",
              !segmentId && "bg-neutral-100 font-medium"
            )}
            onClick={() => {
              clearSegmentFilter()
              setOpen(false)
            }}
          >
            <span>{ALL_SEGMENTS_LABEL}</span>
            {!segmentId ? (
              <Check className="size-3.5 shrink-0 text-neutral-900" />
            ) : null}
          </button>

          {isLoading && segments.length === 0 ? (
            <div className="space-y-2 px-3 py-3" aria-busy>
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="h-8 w-full animate-pulse rounded-md bg-neutral-100"
                />
              ))}
            </div>
          ) : segments.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              No saved segments yet
            </p>
          ) : (
            segments.map((segment) => {
              const isSelected = segment.id === segmentId
              return (
                <button
                  key={segment.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100",
                    isSelected && "bg-neutral-100 font-medium"
                  )}
                  onClick={() => {
                    setSegmentId(segment.id)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {segment.name}
                  </span>
                  {isSelected ? (
                    <Check className="size-3.5 shrink-0 text-neutral-900" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
