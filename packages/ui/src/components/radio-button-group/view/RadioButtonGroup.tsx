"use client"

import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { RadioButtonGroupProps, RadioOption } from "../model/types"
import {
  radioGroupVariants,
  radioOptionVariants,
  radioOptionCheckedVariants,
  radioIndicatorVariants,
  radioIndicatorDotVariants,
} from "../controller/radio-button-group-variants"

const DEFAULT_SELECTED_BG = "#EEF6FF"
const DEFAULT_SELECTED_BORDER = "var(--primary)"

function RadioButtonGroup({
  name,
  options,
  value,
  onChange,
  type = "1",
  layout = "column",
  label,
  error,
  hint,
  containerClassName,
  optionClassName,
  labelClassName,
  className,
  disabled,
  selectedOptionBackgroundColor,
  selectedOptionBorderColor,
  ...props
}: RadioButtonGroupProps) {
  const id = React.useId()
  const fieldsetId = `${id}-fieldset`
  const groupId = `${id}-group`
  const selectedStyle =
    (type === "1" || type === "3") &&
    (selectedOptionBackgroundColor != null || selectedOptionBorderColor != null)
      ? {
          backgroundColor: selectedOptionBackgroundColor ?? DEFAULT_SELECTED_BG,
          borderColor: selectedOptionBorderColor ?? DEFAULT_SELECTED_BORDER,
        }
      : undefined
  const useDefaultSelectedStyle =
    (type === "1" || type === "3") && selectedStyle === undefined

  return (
    <fieldset
      id={fieldsetId}
      data-slot="radio-button-group"
      data-type={type}
      className={cn("space-y-2", containerClassName)}
      disabled={disabled}
      aria-invalid={error != null}
      aria-describedby={
        error ? `${groupId}-error` : hint ? `${groupId}-hint` : undefined
      }
      {...props}
    >
      {label != null && (
        <legend
          className={cn(
            "text-sm leading-none font-medium text-foreground",
            labelClassName
          )}
        >
          {label}
        </legend>
      )}
      <div
        role="radiogroup"
        id={groupId}
        aria-label={label ?? name}
        className={cn(
          radioGroupVariants({ type }),
          type !== "4" && layout === "column" && "flex-col",
          type !== "4" && layout === "row" && "flex-row flex-wrap",
          type === "4" && "flex-row",
          className
        )}
      >
        {options.map((opt: RadioOption) => {
          const optId = `${id}-${opt.value}`
          const isChecked = value === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={optId}
              onClick={() => {
                if (value === opt.value) onChange?.(opt.value)
              }}
              className={cn(
                radioOptionVariants({ type }),
                isChecked && type === "2" && radioOptionCheckedVariants[type],
                isChecked && type === "4" && radioOptionCheckedVariants[type],
                isChecked &&
                  (type === "1" || type === "3") &&
                  "text-foreground",
                useDefaultSelectedStyle &&
                  isChecked &&
                  "border-primary bg-[#EEF6FF]",
                optionClassName
              )}
              style={
                isChecked && (type === "1" || type === "3")
                  ? selectedStyle
                  : undefined
              }
            >
              <span
                className={cn(radioIndicatorVariants({ type }), "relative")}
              >
                <input
                  type="radio"
                  name={name}
                  id={optId}
                  value={opt.value}
                  checked={isChecked}
                  onChange={() => onChange?.(opt.value)}
                  disabled={opt.disabled ?? disabled}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    radioIndicatorDotVariants({ type }),
                    "peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                    type === "1" && isChecked && "border-primary bg-primary",
                    type === "1" && !isChecked && "bg-background"
                  )}
                />
                {type === "1" && isChecked && (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-base font-medium",
                  (type === "1" || !isChecked) && "text-foreground",
                  type !== "1" && isChecked && "text-inherit"
                )}
              >
                {opt.label}
              </span>
            </label>
          )
        })}
      </div>
      {error != null && (
        <p
          id={`${groupId}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {hint != null && error == null && (
        <p id={`${groupId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </fieldset>
  )
}

export { RadioButtonGroup }
