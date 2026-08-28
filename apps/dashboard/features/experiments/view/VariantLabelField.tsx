"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { experimentVariantDisplayLabel } from "@/features/experiments/utils/experiment-table-columns"
import {
  overviewSelectContentClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

const VARIANT_LABEL_MAX_LENGTH = 24

function stripVariantPrefix(raw: string): string {
  return raw
    .trim()
    .replace(/^variants?\s+/i, "")
    .trim()
}

type VariantLabelFieldProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  availableLabels: string[]
  disabled?: boolean
  placeholder?: string
  triggerClassName?: string
}

export function VariantLabelField({
  id,
  value,
  onValueChange,
  availableLabels,
  disabled = false,
  placeholder = "Choose or type a label…",
  triggerClassName,
}: VariantLabelFieldProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [activeIndex, setActiveIndex] = useState(0)

  const labelOptions = useMemo(
    () => Array.from(new Set(availableLabels.filter(Boolean))),
    [availableLabels]
  )

  const filtered = useMemo(() => {
    const query = draft.trim().toLowerCase()
    if (!query) return labelOptions
    return labelOptions.filter((label) => {
      const display = experimentVariantDisplayLabel(label).toLowerCase()
      return label.toLowerCase().includes(query) || display.includes(query)
    })
  }, [draft, labelOptions])

  const customCandidate = useMemo(() => {
    const next = stripVariantPrefix(draft)
    if (!next) return null
    const alreadyListed = labelOptions.some(
      (label) => label.toLowerCase() === next.toLowerCase()
    )
    return alreadyListed ? null : next
  }, [draft, labelOptions])

  const rows = useMemo(() => {
    const list = filtered.map((label) => ({
      value: label,
      label: experimentVariantDisplayLabel(label),
      isCustom: false,
    }))
    if (customCandidate) {
      list.unshift({
        value: customCandidate,
        label: experimentVariantDisplayLabel(customCandidate),
        isCustom: true,
      })
    }
    return list
  }, [customCandidate, filtered])

  useEffect(() => {
    if (!open) setDraft(value)
  }, [open, value])

  useEffect(() => {
    setActiveIndex(0)
  }, [draft, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const commit = (nextRaw: string) => {
    const next = stripVariantPrefix(nextRaw).slice(0, VARIANT_LABEL_MAX_LENGTH)
    if (!next) return
    onValueChange(next)
    setOpen(false)
  }

  const displayValue = value ? experimentVariantDisplayLabel(value) : null

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label="Variant label"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className={cn(
            overviewSelectTriggerClassName,
            "flex h-9 w-full items-center justify-between font-normal",
            !displayValue && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {displayValue ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          overviewSelectContentClassName,
          "w-(--radix-popover-trigger-width) min-w-55 gap-0 overflow-hidden p-0"
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          className="border-b border-neutral-100 p-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Input
            ref={inputRef}
            value={draft}
            disabled={disabled}
            maxLength={VARIANT_LABEL_MAX_LENGTH}
            placeholder="Type a label…"
            aria-label="Type a variant label"
            autoComplete="off"
            spellCheck={false}
            className="h-8 rounded-md border-neutral-200 bg-neutral-50 text-sm shadow-none placeholder:text-neutral-400 focus-visible:bg-white"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === "Escape") {
                event.preventDefault()
                setOpen(false)
                return
              }
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActiveIndex((index) =>
                  rows.length === 0 ? 0 : Math.min(index + 1, rows.length - 1)
                )
                return
              }
              if (event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
                return
              }
              if (event.key === "Enter") {
                event.preventDefault()
                const option = rows[activeIndex]
                if (option) {
                  commit(option.value)
                  return
                }
                commit(draft)
              }
            }}
          />
        </div>

        <div
          id={listId}
          role="listbox"
          className="max-h-56 overflow-y-auto overscroll-contain p-1"
        >
          {rows.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Type a label and press Enter
            </p>
          ) : (
            rows.map((option, index) => {
              const isSelected =
                option.value.toLowerCase() === value.trim().toLowerCase()
              const isActive = index === activeIndex
              return (
                <button
                  key={`${option.isCustom ? "custom" : "opt"}:${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-neutral-800 outline-none",
                    isActive && "bg-neutral-100 text-neutral-950",
                    isSelected && "font-medium"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option.value)}
                >
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={option.label}
                  >
                    {option.isCustom ? `Use ${option.label}` : option.label}
                  </span>
                  {isSelected ? (
                    <Check
                      className="size-3.5 shrink-0 text-neutral-700"
                      aria-hidden
                    />
                  ) : (
                    <span className="size-3.5 shrink-0" aria-hidden />
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
