import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { ProgressBarProps } from "../model/types"
import { progressBarVariants } from "../controller/progress-bar-variants"

function getPercentage(currentStep: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0
  const step = Math.max(0, Math.min(currentStep, totalSteps))
  return (step / totalSteps) * 100
}

const DEFAULT_BG = "var(--muted)"
const DEFAULT_FG = "var(--primary)"
const TYPE8_TRACK = "#d1e9e6"
const TYPE8_FILL = "#26a69a"

function getDefaultForeground(): string {
  return DEFAULT_FG
}

function ProgressBar({
  type = "1",
  currentStep,
  totalSteps,
  stepLabels,
  backgroundColor,
  foregroundColor,
  icon,
  topSlot,
  className,
}: ProgressBarProps) {
  const fg = foregroundColor ?? getDefaultForeground()
  const bg = backgroundColor ?? DEFAULT_BG
  const percentage = getPercentage(currentStep, totalSteps)
  const steps = type === "6" ? (stepLabels?.length ?? totalSteps) : totalSteps
  const labels =
    type === "6" && stepLabels?.length
      ? stepLabels
      : Array.from({ length: steps }, (_, i) => `Step ${i + 1}`)

  return (
    <div
      className={cn(progressBarVariants({ type }), className)}
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progress: ${Math.round(percentage)}%`}
    >
      {type === "1" && (
        <>
          {topSlot != null ? (
            <div className="mb-4 flex items-center justify-center">
              {topSlot}
            </div>
          ) : null}
          <div
            className="relative h-3 w-full rounded-full"
            style={{ backgroundColor: bg }}
          >
            <div
              className="relative h-3 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%`, backgroundColor: fg }}
            />
            {icon != null ? (
              <div
                className="absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center transition-all duration-300"
                style={{ left: `calc(${percentage}% - 18px)` }}
              >
                <div
                  className="flex items-center justify-center rounded-full border-2 border-primary bg-background p-2 shadow-lg"
                  style={{ borderColor: fg }}
                >
                  {icon}
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-center">
            <span
              className="text-sm font-semibold md:text-base"
              style={{ color: fg }}
            >
              {Math.round(percentage)}% Complete
            </span>
          </div>
        </>
      )}
      {type === "2" && (
        <div
          className="relative h-8 w-full rounded-full"
          style={{ backgroundColor: bg }}
        >
          <div
            className="relative flex h-8 items-center justify-end rounded-full pr-2 transition-all duration-300"
            style={{ width: `${percentage}%`, backgroundColor: fg }}
          >
            <span className="text-sm font-semibold whitespace-nowrap text-primary-foreground">
              <span className="md:hidden">{Math.round(percentage)}%</span>
              <span className="hidden md:inline">
                {Math.round(percentage)}% Complete
              </span>
            </span>
          </div>
        </div>
      )}
      {type === "3" && (
        <div className="flex items-center gap-3">
          <div
            className="relative h-2 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: bg }}
          >
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%`, backgroundColor: fg }}
            />
          </div>
          <span
            className="w-10 shrink-0 text-xs font-medium tabular-nums"
            style={{ color: fg }}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      {type === "4" && (
        <div className="flex flex-col gap-2">
          <div className="flex w-full gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className="h-3 flex-1 rounded-sm transition-all duration-300 first:rounded-l-md last:rounded-r-md"
                style={{
                  backgroundColor: i < currentStep ? fg : bg,
                }}
              />
            ))}
          </div>
          <span
            className="text-center text-xs font-medium tabular-nums"
            style={{ color: fg }}
          >
            Step {currentStep} of {totalSteps}
          </span>
        </div>
      )}
      {type === "5" && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: fg }}
            >
              {Math.round(percentage)}% Complete
            </span>
          </div>
          <div
            className="relative h-4 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: bg }}
          >
            <div
              className="h-4 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%`, backgroundColor: fg }}
            />
          </div>
        </>
      )}
      {type === "7" && (
        <div
          className="relative h-2.5 w-full overflow-hidden rounded-none"
          style={{ backgroundColor: bg }}
        >
          <div
            className="h-full rounded-none transition-all duration-300"
            style={{ width: `${percentage}%`, backgroundColor: fg }}
          />
        </div>
      )}
      {type === "8" && (
        <div
          className="relative h-3.5 w-full overflow-hidden rounded-[100px] md:h-3 xl:h-4"
          style={{ backgroundColor: backgroundColor ?? TYPE8_TRACK }}
        >
          <div
            className="h-full max-w-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: foregroundColor ?? TYPE8_FILL,
            }}
          />
        </div>
      )}
      {type === "6" && (
        <div className="flex w-full items-start justify-between gap-0">
          {Array.from({ length: steps }, (_, i) => {
            const stepNumber = i + 1
            const completed = currentStep > stepNumber
            const active = currentStep === stepNumber
            const upcoming = currentStep < stepNumber
            const lineSolid = currentStep >= stepNumber
            return (
              <React.Fragment key={i}>
                {i > 0 ? (
                  <div
                    className="mx-1 -mt-5 h-0.5 min-w-[24px] flex-1 shrink-0 self-center border-t-2 transition-colors duration-300"
                    style={{
                      borderColor: lineSolid ? fg : bg,
                      borderStyle: lineSolid ? "solid" : "dashed",
                    }}
                  />
                ) : null}
                <div className="flex shrink-0 flex-col items-center">
                  <div
                    className="flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300"
                    style={{
                      backgroundColor: completed || active ? fg : "transparent",
                      color:
                        completed || active ? "var(--primary-foreground)" : fg,
                      borderWidth: active || upcoming ? 2 : 0,
                      borderStyle: active || upcoming ? "solid" : "none",
                      borderColor: fg,
                    }}
                  >
                    {stepNumber}
                  </div>
                  <span
                    className={cn(
                      "mt-2 max-w-[120px] text-center text-sm font-medium",
                      active && "text-foreground",
                      completed && "text-muted-foreground",
                      upcoming && "text-muted-foreground/80"
                    )}
                  >
                    {labels[i]}
                  </span>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { ProgressBar }
