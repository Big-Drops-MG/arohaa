"use client"
import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { PhoneNumberInputProps } from "../model/types"

const inputBase =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground placeholder:font-normal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-10"

function formatUSPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d.length > 0 ? `(${d}` : ""
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)} - ${d.slice(6)}`
}

function PhoneNumberInput({
  label,
  error,
  hint,
  value = "",
  onChange,
  containerClassName,
  inputClassName,
  labelClassName,
  id: idProp,
  className,
  onKeyDown,
  ...props
}: PhoneNumberInputProps) {
  const id = React.useId()
  const inputId = idProp ?? id
  const digits = value.replace(/\D/g, "").slice(0, 10)
  const displayValue = formatUSPhone(digits)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && digits.length > 0) {
      onChange?.(digits.slice(0, -1))
      e.preventDefault()
      return
    }
    if (e.key.length === 1 && /\d/.test(e.key) && digits.length < 10) {
      onChange?.(digits + e.key)
      e.preventDefault()
      return
    }
    onKeyDown?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10)
    onChange?.(raw)
  }

  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      {label != null && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-sm leading-none font-medium text-foreground",
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        inputMode="tel"
        autoComplete="tel"
        data-slot="phone-number-input"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="(000) 000 - 0000"
        className={cn(inputBase, inputClassName, className)}
        aria-invalid={error != null}
        aria-describedby={
          error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        {...props}
      />
      {error != null && String(error).trim() !== "" && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {hint != null && error == null && (
        <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export { PhoneNumberInput }
