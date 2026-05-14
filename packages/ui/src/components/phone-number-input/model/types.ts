import type * as React from "react"

export interface PhoneNumberInputProps extends Omit<
  React.ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "type"
> {
  label?: React.ReactNode
  error?: string
  hint?: string
  value?: string
  onChange?: (digits: string) => void
  containerClassName?: string
  inputClassName?: string
  labelClassName?: string
}
