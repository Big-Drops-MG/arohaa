"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"

const FORM_TYPE_OPTIONS = [
  { value: "single" as const, label: "Single Step" },
  { value: "multiple" as const, label: "Multi Step" },
  { value: "zip" as const, label: "Zip" },
] as const

type FormTypeFieldsetProps = {
  value: OverviewLandingFormType
  onChange: (value: OverviewLandingFormType) => void
  name?: string
  disabled?: boolean
}

export function FormTypeFieldset({
  value,
  onChange,
  name = "settingsFormType",
  disabled = false,
}: FormTypeFieldsetProps) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">Form type</legend>
      <div className="grid gap-3 md:grid-cols-3" role="presentation">
        {FORM_TYPE_OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <label
              key={opt.value}
              className={cn(
                "relative flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left shadow-xs transition-[border-color,box-shadow,background-color] outline-none",
                "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background",
                disabled && "cursor-not-allowed opacity-60",
                selected
                  ? "border-primary bg-primary/6 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/35 hover:bg-muted/25"
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
                disabled={disabled}
              />
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/45 bg-background"
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    "size-2 rounded-full bg-primary-foreground transition-opacity",
                    selected ? "opacity-100" : "opacity-0"
                  )}
                />
              </span>
              <span className="text-sm font-medium text-foreground">
                {opt.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
