"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { useDebouncedThrottledQuery } from "@/hooks/use-debounced-throttled-query"
import {
  overviewSelectContentClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

export type SearchableSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  options: SearchableSelectOption[]
  value?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  id?: string
  "aria-label"?: string
  onValueChange: (value: string) => void
}

export function SearchableSelect({
  options,
  value,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  id,
  "aria-label": ariaLabel,
  onValueChange,
}: SearchableSelectProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { inputValue, query, setSearchValue, reset } =
    useDebouncedThrottledQuery()

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )

  const filtered = useMemo(() => {
    if (!query) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.value}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [options, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const pick = (next: string) => {
    onValueChange(next)
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className={cn(
            overviewSelectTriggerClassName,
            "h-9 w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          overviewSelectContentClassName,
          "w-(--radix-popover-trigger-width) min-w-55 gap-0 overflow-hidden p-0",
          contentClassName
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchInputRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          className="border-b border-neutral-100 p-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Input
              ref={searchInputRef}
              type="search"
              value={inputValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="h-8 rounded-md border-neutral-200 bg-neutral-50 pr-2 pl-8 text-sm shadow-none placeholder:text-neutral-400 focus-visible:bg-white"
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === "Escape") {
                  event.preventDefault()
                  handleOpenChange(false)
                  return
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setActiveIndex((index) =>
                    filtered.length === 0
                      ? 0
                      : Math.min(index + 1, filtered.length - 1)
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
                  const option = filtered[activeIndex]
                  if (option) pick(option.value)
                }
              }}
            />
          </div>
        </div>

        <div
          id={listId}
          role="listbox"
          className="max-h-56 overflow-y-auto overscroll-contain p-1"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === activeIndex
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-neutral-800 outline-none",
                    isActive && "bg-neutral-100 text-neutral-950",
                    isSelected && "font-medium"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(option.value)}
                >
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={option.label}
                  >
                    {option.label}
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
