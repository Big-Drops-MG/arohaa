"use client"

import { useEffect, useState } from "react"
import { Filter } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  UTM_FILTER_DIMENSION_OPTIONS,
  utmFilterDimensionLabel,
  type UtmFilterDimension,
} from "@/features/dashboard/model/utm-attribution-filter"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import { useDashboardUtmFilter } from "@/hooks/use-dashboard-utm-filter"

type ProjectAttributionFiltersProps = {
  projectId: string
}

export function ProjectAttributionFilters({
  projectId,
}: ProjectAttributionFiltersProps) {
  const { utmFilter, activeDimension, setUtmDimension, setUtmFilter } =
    useDashboardUtmFilter()
  const [values, setValues] = useState<string[]>([])
  const [isLoadingValues, setIsLoadingValues] = useState(false)

  useEffect(() => {
    if (activeDimension === "all") {
      setValues([])
      return
    }

    let cancelled = false
    setIsLoadingValues(true)

    const url = `/api/landing-pages/${encodeURIComponent(projectId)}/utm-values?dim=${encodeURIComponent(activeDimension)}`

    void fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((payload) => {
        if (cancelled) return
        setValues(Array.isArray(payload) ? payload : [])
      })
      .catch(() => {
        if (!cancelled) setValues([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingValues(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDimension, projectId])

  const dimensionLabel =
    UTM_FILTER_DIMENSION_OPTIONS.find((opt) => opt.id === activeDimension)
      ?.label ?? "All traffic"

  const valueLabel = utmFilter?.value ?? "Select value"

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
      <Select
        value={activeDimension}
        onValueChange={(value) =>
          setUtmDimension(value as UtmFilterDimension | "all")
        }
      >
        <SelectTrigger
          size="sm"
          className={cn(
            overviewSelectTriggerClassName,
            "h-9 w-full gap-2 sm:w-44"
          )}
          aria-label="UTM filter dimension"
        >
          <Filter className="size-3.5 shrink-0 text-white/70" />
          <SelectValue placeholder="All traffic">{dimensionLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="end"
          position="popper"
          side="bottom"
          sideOffset={6}
          avoidCollisions={false}
          className={overviewSelectContentClassName}
        >
          {UTM_FILTER_DIMENSION_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.id}
              value={opt.id}
              className={overviewSelectItemClassName}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeDimension !== "all" ? (
        <Select
          value={utmFilter?.value ?? ""}
          onValueChange={(value) =>
            setUtmFilter({
              dimension: activeDimension,
              value,
            })
          }
          disabled={isLoadingValues || values.length === 0}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              overviewSelectTriggerClassName,
              "h-9 w-full gap-2 sm:max-w-64 sm:min-w-44"
            )}
            aria-label={`${utmFilterDimensionLabel(activeDimension)} value`}
          >
            <SelectValue
              placeholder={
                isLoadingValues
                  ? "Loading…"
                  : values.length === 0
                    ? "No values found"
                    : "Select value"
              }
            >
              {valueLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            position="popper"
            side="bottom"
            sideOffset={6}
            avoidCollisions={false}
            className={cn(
              overviewSelectContentClassName,
              "max-h-72 max-w-[min(100vw-2rem,20rem)]"
            )}
          >
            {values.map((value) => (
              <SelectItem
                key={value}
                value={value}
                className={overviewSelectItemClassName}
              >
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
