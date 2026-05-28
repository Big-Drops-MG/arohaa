"use client"
import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { TextAreaProps } from "../model/types"

const textAreaBase =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 min-h-[80px]"

function TextArea({
  label,
  error,
  hint,
  resize = true,
  containerClassName,
  textareaClassName,
  id: idProp,
  className,
  ...props
}: TextAreaProps) {
  const id = React.useId()
  const textareaId = idProp ?? id

  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      {label != null && (
        <label
          htmlFor={textareaId}
          className="text-sm leading-none font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        data-slot="text-area"
        className={cn(
          textAreaBase,
          resize ? "resize-y" : "resize-none",
          textareaClassName,
          className
        )}
        aria-invalid={error != null}
        aria-describedby={
          error
            ? `${textareaId}-error`
            : hint
              ? `${textareaId}-hint`
              : undefined
        }
        {...props}
      />
      {error != null && (
        <p
          id={`${textareaId}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {hint != null && error == null && (
        <p id={`${textareaId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export { TextArea }
