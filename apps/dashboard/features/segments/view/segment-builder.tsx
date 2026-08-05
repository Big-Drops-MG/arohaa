"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  AVAILABLE_COLUMNS,
  AVAILABLE_OPERATORS,
  type SavedSegment,
  type SegmentGroup,
  type SegmentOperator,
  type SegmentRule,
} from "@/features/segments/model/segment-model"
import {
  fetchSegmentColumnValues,
  fetchSegmentPreviewCount,
  saveSegment,
} from "@/features/segments/controller/segment-controller"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import { Loader2, Plus, Save, Trash2, Users, X } from "lucide-react"

const PREVIEW_DEBOUNCE_MS = 600

const EMPTY_RULE: SegmentRule = {
  column: "source",
  operator: "equals",
  value: "",
}

const VALUE_PLACEHOLDERS: Record<string, string> = {
  source: "e.g. google",
  medium: "e.g. cpc",
  campaign: "e.g. spring_sale",
  term: "e.g. running shoes",
  content: "e.g. hero_banner",
  id: "e.g. campaign-id",
  s1: "e.g. partner-code",
  city: "e.g. Austin",
  country: "e.g. United States",
  device: "e.g. desktop",
  browser: "e.g. Chrome",
  os: "e.g. macOS",
  event: "e.g. form_submit",
  path: "e.g. /pricing",
}

type SegmentBuilderProps = {
  projectId: string
  onSaved?: (segment: SavedSegment) => void
  onCancel?: () => void
}

function fieldLabelClassName() {
  return "text-xs font-medium text-neutral-600"
}

function isMultiValueOperator(operator: SegmentOperator): boolean {
  return operator === "in" || operator === "not_in"
}

function ruleHasValue(rule: SegmentRule): boolean {
  if (Array.isArray(rule.value)) {
    return rule.value.some((item) => String(item).trim() !== "")
  }
  return String(rule.value).trim() !== ""
}

function normalizeRuleValue(
  operator: SegmentOperator,
  value: SegmentRule["value"]
): SegmentRule["value"] {
  if (isMultiValueOperator(operator)) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }
    const text = String(value).trim()
    return text
      ? text
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : []
  }
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim()
  }
  return String(value)
}

function asStringList(value: SegmentRule["value"]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item))
      .filter((item) => item.trim() !== "")
  }
  const text = String(value).trim()
  return text ? [text] : []
}

type ValueFieldProps = {
  rule: SegmentRule
  options: string[]
  isLoading: boolean
  onChange: (value: SegmentRule["value"]) => void
}

function SegmentValueField({
  rule,
  options,
  isLoading,
  onChange,
}: ValueFieldProps) {
  const multi = isMultiValueOperator(rule.operator)
  const selected = asStringList(rule.value)
  const availableOptions = useMemo(() => {
    const set = new Set(options)
    for (const value of selected) set.add(value)
    return [...set]
  }, [options, selected])

  if (isLoading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-muted-foreground shadow-xs">
        <Loader2 className="size-3.5 animate-spin" />
        Loading values…
      </div>
    )
  }

  if (availableOptions.length === 0) {
    return (
      <Input
        value={multi ? selected.join(", ") : String(rule.value ?? "")}
        onChange={(e) => {
          if (multi) {
            onChange(
              e.target.value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
            )
            return
          }
          onChange(e.target.value)
        }}
        placeholder={
          multi
            ? "Comma-separated values…"
            : (VALUE_PLACEHOLDERS[rule.column] ?? "Enter a value…")
        }
        className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
      />
    )
  }

  if (multi) {
    return (
      <div className="space-y-2">
        <Select
          key={selected.join("\0")}
          onValueChange={(next) => {
            if (!next || selected.includes(next)) return
            onChange([...selected, next])
          }}
        >
          <SelectTrigger
            className={cn(overviewSelectTriggerClassName, "h-9 w-full")}
          >
            <SelectValue placeholder="Add a value…" />
          </SelectTrigger>
          <SelectContent
            className={cn(overviewSelectContentClassName, "max-h-64")}
          >
            {availableOptions
              .filter((option) => !selected.includes(option))
              .map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  className={overviewSelectItemClassName}
                >
                  {option}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((value) => (
              <span
                key={value}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-800"
              >
                <span className="truncate" title={value}>
                  {value}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  className="rounded text-neutral-400 transition-colors hover:text-neutral-700"
                  onClick={() =>
                    onChange(selected.filter((item) => item !== value))
                  }
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Select
      value={String(rule.value || "")}
      onValueChange={(next) => onChange(next)}
    >
      <SelectTrigger
        className={cn(overviewSelectTriggerClassName, "h-9 w-full")}
      >
        <SelectValue placeholder="Select a value…" />
      </SelectTrigger>
      <SelectContent className={cn(overviewSelectContentClassName, "max-h-64")}>
        {availableOptions.map((option) => (
          <SelectItem
            key={option}
            value={option}
            className={overviewSelectItemClassName}
          >
            <span className="truncate" title={option}>
              {option}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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
  const [valuesByColumn, setValuesByColumn] = useState<
    Record<string, string[]>
  >({})
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>(
    {}
  )
  const valuesCacheRef = useRef<Record<string, string[]>>({})

  const hasCompleteRules = rules.every(ruleHasValue)
  const canSave = Boolean(name.trim()) && hasCompleteRules && !isSaving

  const columnsInUse = useMemo(
    () => [...new Set(rules.map((rule) => rule.column))].sort().join(","),
    [rules]
  )

  useEffect(() => {
    const columns = columnsInUse ? columnsInUse.split(",") : []
    if (columns.length === 0) return

    const controller = new AbortController()

    for (const column of columns) {
      if (valuesCacheRef.current[column] !== undefined) continue

      setLoadingColumns((prev) =>
        prev[column] ? prev : { ...prev, [column]: true }
      )

      void fetchSegmentColumnValues(projectId, column, controller.signal)
        .then((values) => {
          if (controller.signal.aborted) return
          valuesCacheRef.current[column] = values
          setValuesByColumn((prev) => ({ ...prev, [column]: values }))
        })
        .catch(() => {
          if (controller.signal.aborted) return
          valuesCacheRef.current[column] = []
          setValuesByColumn((prev) => ({ ...prev, [column]: [] }))
        })
        .finally(() => {
          setLoadingColumns((prev) => ({ ...prev, [column]: false }))
        })
    }

    return () => controller.abort()
  }, [columnsInUse, projectId])

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
      setIsLoadingCount(false)
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

  const handleChangeColumn = (index: number, column: string) => {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === index
          ? {
              ...rule,
              column,
              value: isMultiValueOperator(rule.operator) ? [] : "",
            }
          : rule
      )
    )
  }

  const handleChangeOperator = (index: number, operator: SegmentOperator) => {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === index
          ? {
              ...rule,
              operator,
              value: normalizeRuleValue(operator, rule.value),
            }
          : rule
      )
    )
  }

  const handleChangeValue = (index: number, value: SegmentRule["value"]) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, value } : rule))
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please provide a name for the segment")
      return
    }
    if (!hasCompleteRules) {
      setError("Fill in a value for every condition")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const normalizedRules = rules.map((rule) => ({
        ...rule,
        value: normalizeRuleValue(rule.operator, rule.value),
      }))
      const conditions: SegmentGroup = {
        operator: "and",
        rules: normalizedRules,
      }
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Details</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Name the segment so your team can find and reuse it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="segment-name" className={fieldLabelClassName()}>
                Segment name
              </label>
              <Input
                id="segment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High intent desktop users"
                className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="segment-description"
                className={fieldLabelClassName()}
              >
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Input
                id="segment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this audience represents"
                className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              />
            </div>
          </div>
        </section>

        <section
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          aria-live="polite"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600">
            <Users className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Matching visitors
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasCompleteRules
                ? "Live preview across recent traffic"
                : "Complete every condition to preview the audience size"}
            </p>
          </div>
          <div className="flex h-9 min-w-16 items-center justify-end">
            {isLoadingCount ? (
              <Loader2
                className="size-5 animate-spin text-neutral-400"
                aria-label="Loading match count"
              />
            ) : (
              <span className="font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {previewCount !== null ? previewCount.toLocaleString() : "—"}
              </span>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Conditions
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                All conditions must match (AND). Values come from your existing
                traffic.
              </p>
            </div>
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 tabular-nums">
              {rules.length} rule{rules.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_2.5rem] gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:grid">
              <span className={fieldLabelClassName()}>Property</span>
              <span className={fieldLabelClassName()}>Operator</span>
              <span className={fieldLabelClassName()}>Value</span>
              <span className="sr-only">Remove</span>
            </div>

            <div className="divide-y divide-neutral-100">
              {rules.map((rule, index) => (
                <div key={index}>
                  {index > 0 ? (
                    <div className="flex justify-center bg-neutral-50/80 py-1.5">
                      <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                        and
                      </span>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_2.5rem] sm:items-start sm:gap-2">
                    <div className="space-y-1.5 sm:space-y-0">
                      <label
                        className={cn(fieldLabelClassName(), "sm:hidden")}
                        htmlFor={`segment-column-${index}`}
                      >
                        Property
                      </label>
                      <Select
                        value={rule.column}
                        onValueChange={(val) => handleChangeColumn(index, val)}
                      >
                        <SelectTrigger
                          id={`segment-column-${index}`}
                          className={cn(
                            overviewSelectTriggerClassName,
                            "h-9 w-full"
                          )}
                        >
                          <SelectValue placeholder="Property" />
                        </SelectTrigger>
                        <SelectContent
                          className={cn(
                            overviewSelectContentClassName,
                            "max-h-72"
                          )}
                        >
                          {AVAILABLE_COLUMNS.map((col) => (
                            <SelectItem
                              key={col.id}
                              value={col.id}
                              className={overviewSelectItemClassName}
                            >
                              {col.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-0">
                      <label
                        className={cn(fieldLabelClassName(), "sm:hidden")}
                        htmlFor={`segment-operator-${index}`}
                      >
                        Operator
                      </label>
                      <Select
                        value={rule.operator}
                        onValueChange={(val) =>
                          handleChangeOperator(index, val as SegmentOperator)
                        }
                      >
                        <SelectTrigger
                          id={`segment-operator-${index}`}
                          className={cn(
                            overviewSelectTriggerClassName,
                            "h-9 w-full"
                          )}
                        >
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent
                          className={overviewSelectContentClassName}
                        >
                          {AVAILABLE_OPERATORS.map((op) => (
                            <SelectItem
                              key={op.id}
                              value={op.id}
                              className={overviewSelectItemClassName}
                            >
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-0">
                      <label className={cn(fieldLabelClassName(), "sm:hidden")}>
                        Value
                      </label>
                      <SegmentValueField
                        rule={rule}
                        options={valuesByColumn[rule.column] ?? []}
                        isLoading={Boolean(loadingColumns[rule.column])}
                        onChange={(value) => handleChangeValue(index, value)}
                      />
                    </div>

                    <div className="flex justify-end sm:justify-center sm:pt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRule(index)}
                        disabled={rules.length === 1}
                        aria-label={`Remove condition ${index + 1}`}
                        className="size-9 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-200 bg-neutral-50/60 px-3 py-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRule}
                className="h-8 rounded-lg border-neutral-200 bg-white shadow-xs"
              >
                <Plus className="size-3.5" />
                Add condition
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-neutral-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">
          {canSave
            ? "Ready to save"
            : !name.trim()
              ? "Add a segment name to continue"
              : "Fill every condition value to continue"}
        </p>
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="h-9 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save segment
          </Button>
        </div>
      </div>
    </div>
  )
}
