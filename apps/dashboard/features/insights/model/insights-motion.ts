import type { Transition, Variants } from "motion/react"

export const INSIGHTS_ENTER_MS = 280
export const INSIGHTS_PANEL_MS = 180
export const INSIGHTS_STAGGER_MS = 45
export const INSIGHTS_MAX_STAGGER = 8
export const INSIGHTS_CHART_ANIMATION_MS = 320

export const insightsEase = [0.22, 1, 0.36, 1] as const

export const insightsTween: Transition = {
  duration: INSIGHTS_ENTER_MS / 1000,
  ease: insightsEase,
}

export const insightsPanelTween: Transition = {
  duration: INSIGHTS_PANEL_MS / 1000,
  ease: insightsEase,
}

export const insightsShellEnter: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: insightsEase,
      staggerChildren: INSIGHTS_STAGGER_MS / 1000,
      delayChildren: 0.04,
    },
  },
}

export const insightsFadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: insightsTween,
  },
}

export const insightsPanelSwap: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: insightsPanelTween,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.12 },
  },
}

export function insightsStaggerDelay(index: number): number {
  return (
    Math.min(index, INSIGHTS_MAX_STAGGER - 1) * (INSIGHTS_STAGGER_MS / 1000)
  )
}
