"use client"

import { useEffect, useState } from "react"
import { Filter, Check } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { useDashboardSegmentFilter } from "@/hooks/use-dashboard-segment-filter"
import { overviewSelectTriggerClassName } from "@/features/overview/view/overview-select-styles"
import { SegmentGroup } from "../model/segment-model"
import { fetchSegmentPreviewCount } from "../controller/segment-controller"

// Simplified segment list fetcher (since we need it here)
async function fetchSegments(workspaceId: string) {
  const res = await fetch(
    `/api/proxy/v1/segments?workspace_id=${encodeURIComponent(workspaceId)}`
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.segments || []
}

export function SegmentPicker({ projectId }: { projectId: string }) {
  const { segmentId, setSegmentId, clearSegmentFilter } =
    useDashboardSegmentFilter()
  const [open, setOpen] = useState(false)
  const [segments, setSegments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open && segments.length > 0) return
    if (open) {
      setIsLoading(true)
      fetchSegments(projectId)
        .then(setSegments)
        .finally(() => setIsLoading(false))
    }
  }, [open, projectId, segments.length])

  const activeSegment = segments.find((s) => s.id === segmentId)
  const label = activeSegment ? activeSegment.name : "All Traffic"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          overviewSelectTriggerClassName,
          "h-8 gap-1.5 px-3",
          segmentId &&
            "border-neutral-300 bg-neutral-100 text-neutral-900 shadow-sm"
        )}
      >
        <Filter className="size-3.5 opacity-60" />
        <span className="max-w-[120px] truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-0" sideOffset={8}>
        <div className="flex flex-col border-b border-neutral-200">
          <div className="px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Segments
          </div>

          <button
            type="button"
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100",
              !segmentId && "bg-neutral-50 font-medium"
            )}
            onClick={() => {
              clearSegmentFilter()
              setOpen(false)
            }}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border",
                !segmentId
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-transparent"
              )}
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
            All Traffic
          </button>
        </div>

        <div className="flex max-h-[300px] flex-col overflow-y-auto p-1">
          {isLoading ? (
            <div className="p-3 text-center text-sm text-neutral-500">
              Loading...
            </div>
          ) : segments.length === 0 ? (
            <div className="p-3 text-center text-sm text-neutral-500">
              No saved segments
            </div>
          ) : (
            segments.map((seg) => {
              const isSelected = seg.id === segmentId
              return (
                <button
                  key={seg.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-100",
                    isSelected && "bg-neutral-50 font-medium"
                  )}
                  onClick={() => {
                    setSegmentId(seg.id)
                    setOpen(false)
                  }}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-transparent"
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                  <span className="flex-1 truncate">{seg.name}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
