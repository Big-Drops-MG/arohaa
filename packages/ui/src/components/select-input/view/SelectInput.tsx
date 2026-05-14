"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { SelectInputProps, SelectOption } from "../model/types"

const DEBOUNCE_MS = 300

const triggerBase =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-left text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-10 cursor-pointer flex items-center justify-between"

const searchInputBase =
  "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]"

function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  if (!query.trim()) return options
  const q = query.trim().toLowerCase()
  return options.filter(
    (opt: SelectOption) =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
  )
}

function SelectInput({
  label,
  error,
  hint,
  placeholder,
  options,
  value,
  onChange,
  searchable = false,
  searchPlaceholder = "Search...",
  containerClassName,
  selectClassName,
  id: idProp,
  className,
  disabled,
}: SelectInputProps) {
  const id = React.useId()
  const selectId = idProp ?? id
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery),
      DEBOUNCE_MS
    )
    return () => window.clearTimeout(t)
  }, [searchQuery])

  React.useEffect(() => {
    if (!open) setSearchQuery("")
  }, [open])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current != null &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const selectedOption = options.find(
    (opt: SelectOption) => opt.value === value
  )
  const filteredOptions = searchable
    ? filterOptions(options, debouncedSearch)
    : options

  return (
    <div ref={containerRef} className={cn("space-y-1.5", containerClassName)}>
      {label != null && (
        <label
          htmlFor={selectId}
          className="text-sm leading-none font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={selectId}
          data-slot="select-input"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error != null}
          aria-describedby={
            error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
          }
          className={cn(triggerBase, selectClassName, className)}
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              !selectedOption && "text-muted-foreground"
            )}
          >
            {selectedOption?.label ?? placeholder ?? "Select"}
          </span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-lg"
            aria-activedescendant={value ?? undefined}
          >
            {searchable && (
              <div className="border-b border-input p-2">
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className={cn(searchInputBase, "rounded-lg")}
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            <div
              className={cn(
                "overflow-y-auto p-1",
                searchable ? "max-h-48" : "max-h-60"
              )}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No results
                </div>
              ) : (
                filteredOptions.map((opt: SelectOption) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={value === opt.value}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                      value === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => {
                      onChange?.(opt.value)
                      setOpen(false)
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error != null && String(error).trim() !== "" && (
        <p
          id={`${selectId}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {hint != null && error == null && (
        <p id={`${selectId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export { SelectInput }
