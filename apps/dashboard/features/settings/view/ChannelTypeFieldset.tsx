"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  LANDING_PAGE_CHANNEL_TYPES,
  type LandingPageChannelType,
} from "@/features/settings/model/landing-page-channel-types"

type ChannelTypeFieldsetProps = {
  value: LandingPageChannelType | null
  onChange: (value: LandingPageChannelType | null) => void
  name?: string
  disabled?: boolean
}

export function ChannelTypeFieldset({
  value,
  onChange,
  name = "settingsChannelType",
  disabled = false,
}: ChannelTypeFieldsetProps) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        Channel type
      </legend>
      <p className="text-xs text-muted-foreground">
        Optional. Choose whether this project is used for email or social. Click
        the selected option again to clear.
      </p>
      <div className="grid gap-3 sm:grid-cols-2" role="presentation">
        {LANDING_PAGE_CHANNEL_TYPES.map((opt) => {
          const selected = value === opt.id
          return (
            <label
              key={opt.id}
              className={cn(
                "relative flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left shadow-xs transition-[border-color,box-shadow,background-color] outline-none",
                "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background",
                disabled && "cursor-not-allowed opacity-60",
                selected
                  ? "border-primary bg-primary/6 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/35 hover:bg-muted/25"
              )}
              onClick={(event) => {
                if (disabled) return
                if (selected) {
                  event.preventDefault()
                  onChange(null)
                }
              }}
            >
              <input
                type="radio"
                name={name}
                value={opt.id}
                checked={selected}
                onChange={() => onChange(opt.id)}
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
