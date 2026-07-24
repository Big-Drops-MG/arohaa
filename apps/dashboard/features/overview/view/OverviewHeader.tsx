"use client"

import { useMemo, useState, type ReactNode } from "react"
import { CalendarDays, Check, ChevronDown, Info } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"
import {
  formatCustomRangeLabel,
  trafficRangeLabel,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
import { overviewSelectTriggerClassName } from "@/features/overview/view/overview-select-styles"
import { ProjectAttributionFilters } from "@/features/dashboard/view/ProjectAttributionFilters"

type OverviewHeaderProps = {
  title: string
  projectId?: string
  dateRangeOptions: OverviewDateRangeOption[]
  dateRangeId: OverviewDateRangeId
  customRange?: DashboardCustomRange | null
  onDateRangeChange: (id: OverviewDateRangeId) => void
  onCustomRangeChange: (range: DashboardCustomRange) => void
  /** Shown as an info tooltip next to the title. */
  helpContent?: ReactNode
}

type Panel = "presets" | "calendar"

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** First day of the month before `date` — used so dual-month view is prev | current. */
function startOfPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

export function OverviewHeader({
  title,
  projectId,
  dateRangeOptions,
  dateRangeId,
  customRange,
  onDateRangeChange,
  onCustomRangeChange,
  helpContent,
}: OverviewHeaderProps) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<Panel>("presets")
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()

  const selectedLabel = useMemo(() => {
    if (dateRangeId === "custom" && customRange) {
      return formatCustomRangeLabel(customRange.from, customRange.to)
    }
    return trafficRangeLabel(dateRangeId, customRange)
  }, [customRange, dateRangeId])

  const presetOptions = dateRangeOptions.filter((opt) => opt.id !== "custom")

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setPanel("presets")
      return
    }
    setPanel("presets")
    if (customRange) {
      setDraftRange({
        from: parseDateKey(customRange.from),
        to: parseDateKey(customRange.to),
      })
    } else {
      setDraftRange(undefined)
    }
  }

  function selectPreset(id: OverviewDateRangeId) {
    onDateRangeChange(id)
    setOpen(false)
    setPanel("presets")
  }

  function openCustomCalendar() {
    if (customRange) {
      setDraftRange({
        from: parseDateKey(customRange.from),
        to: parseDateKey(customRange.to),
      })
    } else {
      setDraftRange(undefined)
    }
    setPanel("calendar")
  }

  function applyCustomRange() {
    if (!draftRange?.from || !draftRange?.to) return
    onCustomRangeChange({
      from: toDateKey(draftRange.from),
      to: toDateKey(draftRange.to),
    })
    setOpen(false)
    setPanel("presets")
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {helpContent ? (
            <span className="group relative inline-flex">
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`About ${title}`}
              >
                <Info className="size-3.5" aria-hidden />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute top-full left-0 z-50 mt-2 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-neutral-200 bg-neutral-950 px-3.5 py-3 text-left text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
              >
                {helpContent}
              </span>
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Landing page performance at a glance
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        {projectId ? <ProjectAttributionFilters projectId={projectId} /> : null}

        <motion.div
          whileHover={reduceMotion ? undefined : { y: -1 }}
          whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        >
          <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  overviewSelectTriggerClassName,
                  "inline-flex w-full items-center justify-between sm:w-auto sm:min-w-52"
                )}
                aria-label="Date range"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="size-3.5 shrink-0 text-neutral-500" />
                  <span className="truncate">{selectedLabel}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-neutral-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={8}
              className={cn(
                "overflow-hidden rounded-lg border border-neutral-200 p-0 shadow-lg ring-1 shadow-neutral-950/8 ring-black/5",
                panel === "calendar"
                  ? "w-auto max-w-[calc(100vw-2rem)]"
                  : "w-52"
              )}
              onOpenAutoFocus={(event) => {
                if (panel === "calendar") event.preventDefault()
              }}
            >
              {panel === "presets" ? (
                <div className="py-1" role="menu">
                  {presetOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950"
                      onClick={() => selectPreset(opt.id)}
                    >
                      <span>{opt.label}</span>
                      {dateRangeId === opt.id ? (
                        <Check className="size-3.5 shrink-0 text-neutral-900" />
                      ) : null}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950"
                    onClick={openCustomCalendar}
                  >
                    <span>Custom Range</span>
                    {dateRangeId === "custom" ? (
                      <Check className="size-3.5 shrink-0 text-neutral-900" />
                    ) : null}
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="overflow-x-auto p-4"
                    role="group"
                    aria-label="Custom date range calendar"
                  >
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={draftRange}
                      onSelect={setDraftRange}
                      disabled={{ after: new Date() }}
                      defaultMonth={startOfPreviousMonth(
                        draftRange?.to ?? draftRange?.from ?? new Date()
                      )}
                      className="mx-auto"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3">
                    <p className="min-w-0 truncate text-sm text-neutral-600">
                      {draftRange?.from && draftRange?.to
                        ? formatCustomRangeLabel(
                            toDateKey(draftRange.from),
                            toDateKey(draftRange.to)
                          )
                        : "Select a start and end date"}
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-9 px-3"
                        onClick={() => setPanel("presets")}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9 min-w-18 bg-neutral-950 px-3 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-white"
                        disabled={!draftRange?.from || !draftRange?.to}
                        onClick={applyCustomRange}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
        </motion.div>
      </div>
    </div>
  )
}
