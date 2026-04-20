"use client"

import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface OTPInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  className?: string
}

export const OTPInput = React.forwardRef<HTMLDivElement, OTPInputProps>(
  ({ value, onChange, length = 6, disabled, className }, ref) => {
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

    const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const char = e.target.value.slice(-1)
      if (!/^\d*$/.test(char)) return

      const newValue = value.split("")
      while (newValue.length < length) newValue.push("")

      newValue[index] = char
      const updatedValue = newValue.slice(0, length).join("")
      onChange(updatedValue)

      if (char && index < length - 1) {
        inputRefs.current[index + 1]?.focus()
      }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (!value[index] && index > 0) {
          inputRefs.current[index - 1]?.focus()
        } else {
          const newValue = value.split("")
          newValue[index] = ""
          onChange(newValue.join(""))
        }
      }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault()
      const data = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
      onChange(data)
      const lastIndex = Math.min(data.length, length - 1)
      inputRefs.current[lastIndex]?.focus()
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-2 justify-center", className)}>
        {Array.from({ length }).map((_, i) => (
          <React.Fragment key={i}>
            <input
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              pattern="\d{1}"
              maxLength={1}
              value={value[i] || ""}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={disabled}
              className="w-10 h-12 text-center text-lg font-semibold border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 border-input shadow-sm"
            />
            {i === 2 && length === 6 && (
              <span className="text-muted-foreground font-bold px-1">-</span>
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }
)

OTPInput.displayName = "OTPInput"
