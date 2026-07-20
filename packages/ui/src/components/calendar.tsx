"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker"
import "react-day-picker/style.css"

import { cn } from "@workspace/ui/lib/utils"
import { buttonVariants } from "@workspace/ui/components/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  captionLayout = "label",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      navLayout="around"
      className={cn(
        "group/calendar rdp-root bg-background p-3 [--cell-size:2.5rem]",
        "[&_.rdp-months]:gap-8",
        className
      )}
      style={
        {
          "--rdp-accent-color": "var(--primary)",
          "--rdp-accent-background-color": "var(--accent)",
          "--rdp-day-height": "var(--cell-size)",
          "--rdp-day-width": "var(--cell-size)",
          "--rdp-day_button-height": "var(--cell-size)",
          "--rdp-day_button-width": "var(--cell-size)",
          "--rdp-day_button-border-radius": "0.375rem",
          "--rdp-nav_button-height": "2.5rem",
          "--rdp-nav_button-width": "2.5rem",
          "--rdp-nav-height": "2.75rem",
          "--rdp-months-gap": "2rem",
          "--rdp-outside-opacity": "0.72",
          "--rdp-disabled-opacity": "0.55",
          "--rdp-today-color": "var(--foreground)",
          "--rdp-range_middle-background-color": "var(--accent)",
          "--rdp-range_middle-color": "var(--accent-foreground)",
          "--rdp-range_start-date-background-color": "var(--primary)",
          "--rdp-range_end-date-background-color": "var(--primary)",
          "--rdp-range_start-color": "var(--primary-foreground)",
          "--rdp-range_end-color": "var(--primary-foreground)",
          "--rdp-weekday-opacity": "1",
          "--rdp-weekday-padding": "0.625rem 0",
        } as React.CSSProperties
      }
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-8 sm:flex-row sm:gap-8",
          defaultClassNames.months
        ),
        month: cn(
          "relative flex w-[calc(var(--cell-size)*7)] flex-col gap-3",
          defaultClassNames.month
        ),
        month_caption: cn(
          "flex h-11 w-full items-center justify-center px-11 text-sm font-semibold text-foreground",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "text-sm font-semibold text-foreground",
          defaultClassNames.caption_label
        ),
        nav: cn(
          "absolute inset-x-0 top-0 z-10 flex h-11 w-full items-center justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-10 shrink-0 rounded-md border-border bg-background text-foreground shadow-none",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "aria-disabled:pointer-events-none aria-disabled:opacity-40",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-10 shrink-0 rounded-md border-border bg-background text-foreground shadow-none",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "aria-disabled:pointer-events-none aria-disabled:opacity-40",
          defaultClassNames.button_next
        ),
        month_grid: cn(
          "w-full table-fixed border-collapse",
          defaultClassNames.month_grid
        ),
        weekdays: cn("w-full", defaultClassNames.weekdays),
        weekday: cn(
          "h-9 w-[var(--cell-size)] p-0 text-center text-xs font-semibold tracking-wide text-neutral-700",
          defaultClassNames.weekday
        ),
        week: cn("mt-1 w-full", defaultClassNames.week),
        day: cn(
          "relative h-[var(--cell-size)] w-[var(--cell-size)] p-0 text-center align-middle",
          defaultClassNames.day
        ),
        day_button: cn(
          "inline-flex size-[var(--cell-size)] items-center justify-center rounded-md text-sm font-medium",
          defaultClassNames.day_button
        ),
        range_start: cn(
          "rounded-l-md bg-neutral-200 [&>button]:bg-neutral-950 [&>button]:text-white [&>button]:hover:bg-neutral-950",
          defaultClassNames.range_start
        ),
        range_middle: cn(
          "bg-neutral-200 [&>button]:rounded-none [&>button]:bg-transparent [&>button]:font-medium [&>button]:text-neutral-900",
          defaultClassNames.range_middle
        ),
        range_end: cn(
          "rounded-r-md bg-neutral-200 [&>button]:bg-neutral-950 [&>button]:text-white [&>button]:hover:bg-neutral-950",
          defaultClassNames.range_end
        ),
        selected: cn(
          "[&>button]:bg-neutral-950 [&>button]:text-white",
          defaultClassNames.selected
        ),
        today: cn(
          "[&>button]:font-bold [&>button]:ring-2 [&>button]:ring-neutral-900 [&>button]:ring-offset-1",
          defaultClassNames.today
        ),
        outside: cn("text-neutral-500 opacity-80", defaultClassNames.outside),
        disabled: cn("text-neutral-400 opacity-70", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        chevron: cn("size-4 text-foreground", defaultClassNames.chevron),
        ...classNames,
      }}
      components={{
        Chevron: ({
          className: chevronClassName,
          orientation,
          ...chevronProps
        }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeftIcon
              : orientation === "right"
                ? ChevronRightIcon
                : ChevronDownIcon
          return (
            <Icon
              aria-hidden
              className={cn("size-4 text-foreground", chevronClassName)}
              {...chevronProps}
            />
          )
        },
        DayButton: CalendarDayButton,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={Boolean(
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      )}
      data-range-start={modifiers.range_start || undefined}
      data-range-end={modifiers.range_end || undefined}
      data-range-middle={modifiers.range_middle || undefined}
      className={cn(
        "inline-flex size-[var(--cell-size)] items-center justify-center rounded-md text-sm font-medium text-neutral-900 transition-colors",
        "hover:bg-neutral-100 hover:text-neutral-950",
        "focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:outline-none",
        "data-[selected-single=true]:bg-neutral-950 data-[selected-single=true]:text-white data-[selected-single=true]:hover:bg-neutral-950",
        "data-[range-start=true]:bg-neutral-950 data-[range-start=true]:text-white data-[range-start=true]:hover:bg-neutral-950",
        "data-[range-end=true]:bg-neutral-950 data-[range-end=true]:text-white data-[range-end=true]:hover:bg-neutral-950",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-neutral-900",
        "disabled:pointer-events-none disabled:text-neutral-400 disabled:opacity-70",
        defaultClassNames.day_button,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
