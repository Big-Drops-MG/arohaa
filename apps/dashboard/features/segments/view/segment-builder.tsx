"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Input } from "@workspace/ui/components/input"
import {
  AVAILABLE_COLUMNS,
  AVAILABLE_OPERATORS,
  type SavedSegment,
  type SegmentGroup,
  type SegmentOperator,
  type SegmentRule,
} from "@/features/segments/model/segment-model"
import {
  fetchSegmentPreviewCount,
  saveSegment,
} from "@/features/segments/controller/segment-controller"
import { Loader2, PlusCircle, Save, Trash2 } from "lucide-react"

const PREVIEW_DEBOUNCE_MS = 600

const EMPTY_RULE: SegmentRule = {
  column: "city",
  operator: "equals",
  value: "",
}

type SegmentBuilderProps = {
  projectId: string
  onSaved?: (segment: SavedSegment) => void
  onCancel?: () => void
}

export function SegmentBuilder({
  projectId,
  onSaved,
  onCancel,
}: SegmentBuilderProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [rules, setRules] = useState<SegmentRule[]>([{ ...EMPTY_RULE }])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [isLoadingCount, setIsLoadingCount] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasCompleteRules = rules.every(
    (rule) => String(rule.value).trim() !== ""
  )

  const loadPreview = useCallback(
    async (signal: AbortSignal) => {
      setIsLoadingCount(true)
      setError(null)
      try {
        const conditions: SegmentGroup = { operator: "and", rules }
        const count = await fetchSegmentPreviewCount(
          projectId,
          conditions,
          signal
        )
        if (signal.aborted) return
        setPreviewCount(count)
      } catch (err) {
        if (signal.aborted) return
        setError(err instanceof Error ? err.message : "Failed to load preview")
        setPreviewCount(null)
      } finally {
        if (!signal.aborted) setIsLoadingCount(false)
      }
    },
    [projectId, rules]
  )

  useEffect(() => {
    if (!hasCompleteRules) {
      setPreviewCount(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void loadPreview(controller.signal)
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [hasCompleteRules, loadPreview])

  const handleAddRule = () => {
    setRules((prev) => [...prev, { ...EMPTY_RULE }])
  }

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleChangeRule = (
    index: number,
    key: keyof SegmentRule,
    value: SegmentRule[keyof SegmentRule]
  ) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule))
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please provide a name for the segment")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const conditions: SegmentGroup = { operator: "and", rules }
      const saved = await saveSegment(
        projectId,
        name.trim(),
        description.trim() || undefined,
        conditions
      )
      setName("")
      setDescription("")
      setRules([{ ...EMPTY_RULE }])
      setPreviewCount(null)
      onSaved?.(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save segment")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Segment name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High intent desktop users"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Description (optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Visitors who arrived from desktop"
            />
          </div>
        </div>

        <div className="flex min-w-[140px] flex-col items-end rounded-lg border border-neutral-200 bg-white px-4 py-2">
          <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Matching visitors
          </span>
          <div className="mt-1 flex h-8 items-center">
            {isLoadingCount ? (
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            ) : (
              <span className="text-2xl font-bold text-neutral-900">
                {previewCount !== null ? previewCount.toLocaleString() : "—"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-sm font-medium text-neutral-700">
          Conditions (all must match)
        </div>

        {rules.map((rule, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-2"
          >
            <div className="w-[180px]">
              <Select
                value={rule.column}
                onValueChange={(val) => handleChangeRule(index, "column", val)}
              >
                <SelectTrigger className="w-full border-0 bg-white shadow-none focus:ring-0">
                  <SelectValue placeholder="Column" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_COLUMNS.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[180px]">
              <Select
                value={rule.operator}
                onValueChange={(val) =>
                  handleChangeRule(index, "operator", val as SegmentOperator)
                }
              >
                <SelectTrigger className="w-full border-0 bg-white text-neutral-600 shadow-none focus:ring-0">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_OPERATORS.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Input
                value={String(rule.value)}
                onChange={(e) =>
                  handleChangeRule(index, "value", e.target.value)
                }
                placeholder="Value..."
                className="w-full border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveRule(index)}
              disabled={rules.length === 1}
              className="text-neutral-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRule}
          className="mt-2 bg-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add condition
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        ) : null}
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim() || !hasCompleteRules}
          className="bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save segment
        </Button>
      </div>
    </div>
  )
}
