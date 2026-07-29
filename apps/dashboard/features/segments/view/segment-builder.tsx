"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@workspace/ui/components/card"
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
  SegmentGroup,
  SegmentRule,
  SegmentOperator,
} from "../model/segment-model"
import {
  fetchSegmentPreviewCount,
  saveSegment,
} from "../controller/segment-controller"
import { PlusCircle, Trash2, Loader2, Save } from "lucide-react"

interface SegmentBuilderProps {
  workspaceId: string
  onSave?: (segment: any) => void
}

export function SegmentBuilder({ workspaceId, onSave }: SegmentBuilderProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [rules, setRules] = useState<SegmentRule[]>([
    { column: "city", operator: "equals", value: "" },
  ])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [isLoadingCount, setIsLoadingCount] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced preview
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPreview()
    }, 800)
    return () => clearTimeout(timer)
  }, [rules])

  const loadPreview = async () => {
    // Only preview if rules are somewhat valid (non empty values)
    const isValid = rules.every((r) => r.value !== "")
    if (!isValid) {
      setPreviewCount(null)
      return
    }

    setIsLoadingCount(true)
    setError(null)
    try {
      const conditionGroup: SegmentGroup = {
        operator: "and",
        rules: rules,
      }
      const count = await fetchSegmentPreviewCount(workspaceId, conditionGroup)
      setPreviewCount(count)
    } catch (err: any) {
      setError(err.message || "Failed to load preview")
      setPreviewCount(null)
    } finally {
      setIsLoadingCount(false)
    }
  }

  const handleAddRule = () => {
    setRules([...rules, { column: "city", operator: "equals", value: "" }])
  }

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const handleChangeRule = (index: number, patch: Partial<SegmentRule>) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
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
      const conditionGroup: SegmentGroup = {
        operator: "and",
        rules: rules,
      }
      const saved = await saveSegment(
        workspaceId,
        name,
        description,
        conditionGroup
      )
      if (onSave) onSave(saved)
      // Reset form
      setName("")
      setDescription("")
      setRules([{ column: "city", operator: "equals", value: "" }])
    } catch (err: any) {
      setError(err.message || "Failed to save segment")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-4xl border-neutral-200 shadow-sm">
      <CardHeader className="rounded-t-xl border-b border-neutral-200 bg-neutral-50 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-neutral-900">
              Create Segment
            </CardTitle>
            <CardDescription className="mt-1 text-neutral-500">
              Define conditions to filter your users dynamically.
            </CardDescription>
          </div>
          <div className="flex min-w-[120px] flex-col items-end rounded-lg border border-neutral-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Matching Visitors
            </span>
            <div className="mt-1 flex items-center gap-2">
              {isLoadingCount ? (
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              ) : (
                <span className="text-2xl font-bold text-neutral-900">
                  {previewCount !== null ? previewCount.toLocaleString() : "-"}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Segment Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., High Intent Desktop Users"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Description (Optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Users who visited from desktop"
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="mb-2 text-sm font-medium text-neutral-700">
            Conditions (AND)
          </div>

          {rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-2 shadow-sm transition-all hover:border-neutral-300"
            >
              <div className="w-[180px]">
                <Select
                  value={rule.column}
                  onValueChange={(val) =>
                    handleChangeRule(index, { column: val })
                  }
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
                    handleChangeRule(index, {
                      operator: val as SegmentOperator,
                    })
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
                  value={rule.value as string}
                  onChange={(e) =>
                    handleChangeRule(index, { value: e.target.value })
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
            className="mt-2 border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Condition
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-500">
            {error}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-3 rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-6 py-4">
        <Button variant="outline">Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Segment
        </Button>
      </CardFooter>
    </Card>
  )
}
