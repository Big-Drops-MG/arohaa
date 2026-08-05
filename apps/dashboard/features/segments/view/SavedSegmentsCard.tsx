"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Loader2, PlusCircle, Trash2 } from "lucide-react"
import {
  deleteSegment,
  fetchSavedSegments,
} from "@/features/segments/controller/segment-controller"
import {
  AVAILABLE_COLUMNS,
  AVAILABLE_OPERATORS,
  type SavedSegment,
  type SegmentGroup,
  type SegmentRule,
} from "@/features/segments/model/segment-model"
import { SegmentBuilder } from "@/features/segments/view/segment-builder"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"

function isRule(node: SegmentRule | SegmentGroup): node is SegmentRule {
  return "column" in node
}

function describeConditions(conditions: SegmentGroup): string {
  const rules = conditions?.rules ?? []
  const parts = rules.filter(isRule).map((rule) => {
    const column =
      AVAILABLE_COLUMNS.find((col) => col.id === rule.column)?.label ??
      rule.column
    const operator =
      AVAILABLE_OPERATORS.find((op) => op.id === rule.operator)?.label ??
      rule.operator
    const value = Array.isArray(rule.value)
      ? rule.value.join(", ")
      : String(rule.value)
    return `${column} ${operator.toLowerCase()} ${value}`
  })

  return parts.length ? parts.join(" and ") : "No conditions"
}

type SavedSegmentsCardProps = {
  projectId: string
}

export function SavedSegmentsCard({ projectId }: SavedSegmentsCardProps) {
  const [segments, setSegments] = useState<SavedSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadSegments = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchSavedSegments(projectId, signal)
        if (signal?.aborted) return
        setSegments(data)
      } catch (err) {
        if (signal?.aborted) return
        setError(err instanceof Error ? err.message : "Failed to load segments")
      } finally {
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadSegments(controller.signal)
    return () => controller.abort()
  }, [loadSegments])

  const handleDelete = async (segmentId: string) => {
    setDeletingId(segmentId)
    setError(null)
    try {
      await deleteSegment(projectId, segmentId)
      setSegments((prev) => prev.filter((segment) => segment.id !== segmentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete segment")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card className={overviewAnalyticCardShellClassName}>
        <CardHeader className={overviewAnalyticCardHeaderClassName}>
          <div className="flex w-full items-center justify-between gap-3">
            <CardTitle className={overviewSectionHeadingClassName}>
              Saved segments
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBuilderOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New segment
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading segments...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          ) : segments.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No saved segments yet. Create one to filter visitors by traffic
              source, location, device and more.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {segments.map((segment) => (
                <li
                  key={segment.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {segment.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {segment.description ||
                        describeConditions(segment.conditions)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(segment.id)}
                    disabled={deletingId === segment.id}
                    className="text-neutral-400 hover:bg-red-50 hover:text-red-500"
                  >
                    {deletingId === segment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="flex max-h-[min(90vh,760px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
            <DialogHeader className="gap-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Create segment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Build a reusable audience filter from visitor properties.
              </DialogDescription>
            </DialogHeader>
          </div>

          {isBuilderOpen ? (
            <SegmentBuilder
              projectId={projectId}
              onCancel={() => setIsBuilderOpen(false)}
              onSaved={(segment) => {
                setSegments((prev) => [...prev, segment])
                setIsBuilderOpen(false)
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
