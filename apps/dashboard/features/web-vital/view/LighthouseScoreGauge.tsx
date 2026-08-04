"use client"

import { cn } from "@workspace/ui/lib/utils"
import { lighthouseScoreTone } from "@/features/web-vital/utils/web-vital-format"

type LighthouseScoreGaugeProps = {
  score: number | null
  className?: string
}

const SIZE = 104
const STROKE = 9
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function scoreColor(tone: ReturnType<typeof lighthouseScoreTone>): string {
  switch (tone) {
    case "good":
      return "#059669"
    case "average":
      return "#d97706"
    case "poor":
      return "#dc2626"
    default:
      return "#a3a3a3"
  }
}

export function LighthouseScoreGauge({
  score,
  className,
}: LighthouseScoreGaugeProps) {
  const tone = lighthouseScoreTone(score)
  const progress = score == null ? 0 : Math.min(100, Math.max(0, score)) / 100
  const offset = CIRCUMFERENCE * (1 - progress)
  const color = scoreColor(tone)

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center rounded-xl border border-border bg-white px-4 py-3.5",
        className
      )}
    >
      <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
        Lighthouse score
      </p>
      <div className="relative mt-2.5" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#f5f5f5"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-semibold tracking-tight tabular-nums"
            style={{ color }}
          >
            {score == null ? 0 : Math.round(score)}
          </span>
          <span className="text-[10px] text-neutral-400">/ 100</span>
        </div>
      </div>
      <p className="mt-2.5 text-center text-[11px] leading-snug text-neutral-500">
        From field p75 FCP, LCP, INP & CLS
      </p>
    </div>
  )
}
