"use client"
import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { ZipCodeInputProps } from "../model/types"

const inputBase =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground placeholder:font-normal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-10"

const ZIP_LENGTH = 5

function ZipCodeInput({
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
  ...props
}: ZipCodeInputProps) {
  const id = React.useId()
  const inputId = idProp ?? id
  const digits = value.replace(/\D/g, "").slice(0, ZIP_LENGTH)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, ZIP_LENGTH)
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
        inputMode="numeric"
        autoComplete="postal-code"
        data-slot="zip-code-input"
        value={digits}
        onChange={handleChange}
        maxLength={ZIP_LENGTH}
        placeholder="12345"
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

export { ZipCodeInput }
