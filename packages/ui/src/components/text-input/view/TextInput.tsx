"use client"
import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { TextInputProps } from "../model/types"
import { textInputVariants } from "../controller/text-input-variants"

function TextInput({
  label,
  error,
  hint,
  containerClassName,
  inputClassName,
  labelClassName,
  size = "default",
  id: idProp,
  className,
  ...props
}: TextInputProps) {
  const id = React.useId()
  const inputId = idProp ?? id

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
        data-slot="text-input"
        className={cn(textInputVariants({ size }), inputClassName, className)}
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

export { TextInput, textInputVariants }
