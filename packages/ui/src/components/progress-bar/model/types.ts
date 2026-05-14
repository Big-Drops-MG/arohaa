import type * as React from "react"

export type ProgressBarType = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"

export interface ProgressBarProps {
  type?: ProgressBarType
  currentStep: number
  totalSteps: number
  stepLabels?: string[]
  backgroundColor?: string
  foregroundColor?: string
  icon?: React.ReactNode
  topSlot?: React.ReactNode
  className?: string
}
