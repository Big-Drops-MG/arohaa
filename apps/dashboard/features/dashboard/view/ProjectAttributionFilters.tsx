"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, Filter, Search } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  UTM_FILTER_DIMENSION_OPTIONS,
  formatDashboardUtmFilterLabel,
  hasDashboardUtmFilter,
  isDimensionValueSelected,
  normalizeDashboardUtmFilter,
  type UtmFilterDimension,
} from "@/features/dashboard/model/utm-attribution-filter"
import { overviewSelectTriggerClassName } from "@/features/overview/view/overview-select-styles"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"

type ProjectAttributionFiltersProps = {
  projectId: string
}

type ValuesByDimension = Record<UtmFilterDimension, string[]>

const EMPTY_VALUES: ValuesByDimension = {
  utm_source: [],
  utm_s1: [],
}

function filterValues(values: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return values
  return values.filter((value) => value.toLowerCase().includes(q))
}

export function ProjectAttributionFilters({
  projectId,
}: ProjectAttributionFiltersProps) {
  const { utmFilter, clearUtmFilter, toggleDimensionValue } =
    useDashboardUtmFilter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [valuesByDimension, setValuesByDimension] =
    useState<ValuesByDimension>(EMPTY_VALUES)
  const [isLoadingValues, setIsLoadingValues] = useState(false)

  const selected = normalizeDashboardUtmFilter(utmFilter)
  const triggerLabel = formatDashboardUtmFilterLabel(selected)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setIsLoadingValues(true)

    void Promise.all(
      UTM_FILTER_DIMENSION_OPTIONS.map(async (opt) => {
        const url = `/api/landing-pages/${encodeURIComponent(projectId)}/utm-values?dim=${encodeURIComponent(opt.id)}`
        try {
          const res = await fetch(url, { cache: "no-store" })
          const payload = res.ok ? await res.json() : []
          return [
            opt.id,
            Array.isArray(payload) ? (payload as string[]) : [],
          ] as const
        } catch {
          return [opt.id, [] as string[]] as const
        }
      })
    )
      .then((entries) => {
        if (cancelled) return
        const source =
          entries.find(([id]) => id === "utm_source")?.[1] ?? ([] as string[])
        const s1 =
          entries.find(([id]) => id === "utm_s1")?.[1] ?? ([] as string[])
        setValuesByDimension({
          utm_source: [...source],
          utm_s1: [...s1],
        })
      })
      .finally(() => {
        if (!cancelled) setIsLoadingValues(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const filteredByDimension = useMemo(() => {
    return {
      utm_source: filterValues(valuesByDimension.utm_source, search),
      utm_s1: filterValues(valuesByDimension.utm_s1, search),
    }
  }, [search, valuesByDimension])

  const searchActive = search.trim().length > 0
  const hasAnyFiltered =
    filteredByDimension.utm_source.length > 0 ||
    filteredByDimension.utm_s1.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            overviewSelectTriggerClassName,
            "inline-flex w-full max-w-full items-center justify-between sm:w-auto sm:max-w-80 sm:min-w-44"
          )}
          aria-label="Traffic attribution filter"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Filter className="size-3.5 shrink-0 text-neutral-500" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-neutral-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[min(100vw-2rem,20rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white p-0 text-neutral-900 shadow-lg ring-1 shadow-neutral-950/8 ring-black/5"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        <div className="border-b border-neutral-200 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search source or S1…"
              className="h-9 border-neutral-200 bg-white pl-8 text-sm shadow-none focus-visible:border-neutral-400 focus-visible:ring-neutral-900/10"
              aria-label="Search UTM values"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {!searchActive ? (
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100",
                !hasDashboardUtmFilter(selected) && "bg-neutral-100 font-medium"
              )}
              onClick={() => {
                clearUtmFilter()
              }}
            >
              <span>All traffic</span>
              {!hasDashboardUtmFilter(selected) ? (
                <Check className="size-3.5 shrink-0 text-neutral-900" />
              ) : null}
            </button>
          ) : null}

          {isLoadingValues ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              Loading values…
            </p>
          ) : searchActive && !hasAnyFiltered ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              No matching values
            </p>
          ) : (
            UTM_FILTER_DIMENSION_OPTIONS.map((opt) => {
              const values = filteredByDimension[opt.id]
              if (searchActive && values.length === 0) return null

              return (
                <div key={opt.id} className="mt-1 first:mt-0">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                    {opt.label}
                  </div>
                  {values.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-neutral-400">
                      No values found
                    </p>
                  ) : (
                    values.map((value) => {
                      const isSelected = isDimensionValueSelected(
                        selected,
                        opt.id,
                        value
                      )
                      return (
                        <button
                          key={`${opt.id}:${value}`}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100",
                            isSelected && "bg-neutral-100 font-medium"
                          )}
                          onClick={() => {
                            toggleDimensionValue(opt.id, value)
                          }}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border",
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-300 bg-white text-transparent"
                            )}
                            aria-hidden
                          >
                            <Check className="size-2.5" strokeWidth={3} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {value}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )
            })
          )}
        </div>

        {hasDashboardUtmFilter(selected) ? (
          <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2">
            <button
              type="button"
              className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
              onClick={() => clearUtmFilter()}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
