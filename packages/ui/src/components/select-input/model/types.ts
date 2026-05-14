import type * as React from "react"

export interface SelectOption {
  value: string
  label: string
}

export interface SelectInputProps extends Omit<
  React.ComponentPropsWithoutRef<"select">,
  "children" | "value" | "onChange"
> {
  label?: string
  error?: string
  hint?: string
  placeholder?: string
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  searchable?: boolean
  searchPlaceholder?: string
  containerClassName?: string
  selectClassName?: string
}
