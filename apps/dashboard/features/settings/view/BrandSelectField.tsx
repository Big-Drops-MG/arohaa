"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

type BrandSelectFieldProps = {
  id?: string
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
}

export function BrandSelectField({
  id = "settings-brand",
  value,
  options,
  onChange,
  disabled = false,
}: BrandSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const normalizedOptions = useMemo(() => {
    const unique = new Map<string, string>()
    for (const option of options) {
      const trimmed = option.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (!unique.has(key)) unique.set(key, trimmed)
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b))
  }, [options])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return normalizedOptions
    return normalizedOptions.filter((option) =>
      option.toLowerCase().includes(needle)
    )
  }, [normalizedOptions, query])

  const exactMatch = normalizedOptions.some(
    (option) => option.toLowerCase() === query.trim().toLowerCase()
  )
  const canCreate = query.trim().length > 0 && !exactMatch

  function selectBrand(next: string) {
    onChange(next.trim())
    setQuery("")
    setOpen(false)
  }

  function clearBrand() {
    onChange("")
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Brand</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-11 w-full justify-between px-3 font-normal"
          >
            <span
              className={cn(
                "truncate",
                !value.trim() && "text-muted-foreground"
              )}
            >
              {value.trim() || "Select or create a brand"}
            </span>
            <ChevronsUpDown
              className="ml-2 size-4 shrink-0 opacity-50"
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-2"
          align="start"
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or type a new brand"
            className="h-9"
            autoFocus
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {value.trim() ? (
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                onClick={clearBrand}
              >
                Clear brand
              </button>
            ) : null}
            {filtered.map((option) => {
              const selected =
                option.toLowerCase() === value.trim().toLowerCase()
              return (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                    selected && "bg-muted"
                  )}
                  onClick={() => selectBrand(option)}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      selected ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{option}</span>
                </button>
              )
            })}
            {canCreate ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => selectBrand(query)}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  Create &ldquo;{query.trim()}&rdquo;
                </span>
              </button>
            ) : null}
            {!canCreate && filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No matching brands.
              </p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Landing pages that share this brand (for example Quotifii) appear
        together on the dashboard.
      </p>
    </div>
  )
}
