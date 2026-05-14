import type * as React from "react"

export interface ZipCodeInputProps extends Omit<
  React.ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "type" | "maxLength"
> {
  label?: React.ReactNode
  error?: string
  hint?: string
  value?: string
  onChange?: (value: string) => void
  containerClassName?: string
  inputClassName?: string
  labelClassName?: string
  maxLength?: 5
}
