import type * as React from "react"

export interface TextAreaProps extends React.ComponentPropsWithoutRef<"textarea"> {
  label?: string
  error?: string
  hint?: string
  resize?: boolean
  containerClassName?: string
  textareaClassName?: string
}
