"use client"

import { useMemo } from "react"
import { useReducedMotion } from "motion/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { InsightChart } from "@/features/insights/model/insights"
import { INSIGHTS_CHART_ANIMATION_MS } from "@/features/insights/model/insights-motion"
import { insightsSeriesColor } from "@/features/insights/view/charts/insights-colors"

const CHART_H = 280

function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message ?? "Not enough events in this range"}
    </div>
  )
}

function chartHasData(chart: InsightChart): boolean {
  if (chart.type === "table") return (chart.points?.length ?? 0) > 0
  if (chart.type === "heatmap") return (chart.points?.length ?? 0) > 0
  return (chart.points?.length ?? 0) > 0
}

type InsightsChartRendererProps = {
  chart: InsightChart
  animateKey?: string
}

export function InsightsChartRenderer({
  chart,
  animateKey,
}: InsightsChartRendererProps) {
  const reduceMotion = useReducedMotion()
  const animate = !reduceMotion
  const xKey = chart.xKey ?? "label"
  const seriesKeys = chart.seriesKeys ?? ["value"]
  const animKey = animateKey ?? `${chart.id}:${chart.points.length}`

  const heatmapMax = useMemo(() => {
    if (chart.type !== "heatmap") return 1
    return Math.max(1, ...chart.points.map((p) => Number(p.value ?? 0) || 0))
  }, [chart])

  if (!chartHasData(chart)) {
    return <EmptyChart message={chart.emptyMessage} />
  }

  if (chart.type === "table") {
    const cols = chart.columns ?? [
      { key: "label", label: "Label" },
      { key: "value", label: "Value" },
    ]
    return (
      <div className="max-h-[320px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="border-b px-2 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.points.map((row, i) => (
              <tr key={i} className="border-b border-neutral-100">
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-2 tabular-nums">
                    {String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (chart.type === "heatmap") {
    const rows = chart.rowKeys ?? []
    const cols = chart.colKeys ?? []
    const lookup = new Map(
      chart.points.map((p) => [`${p.row}:${p.col}`, Number(p.value ?? 0) || 0])
    )
    return (
      <div className="overflow-x-auto">
        <div
          className="inline-grid min-w-full gap-0.5"
          style={{
            gridTemplateColumns: `minmax(72px,auto) repeat(${cols.length}, minmax(28px,1fr))`,
          }}
        >
          <div />
          {cols.map((c) => (
            <div
              key={c}
              className="truncate px-0.5 text-center text-[10px] text-muted-foreground"
              title={c}
            >
              {c}
            </div>
          ))}
          {rows.map((r) => (
            <div key={r} className="contents">
              <div className="truncate pr-2 text-xs text-muted-foreground">
                {r}
              </div>
              {cols.map((c) => {
                const v = lookup.get(`${r}:${c}`) ?? 0
                const t = v / heatmapMax
                return (
                  <div
                    key={`${r}-${c}`}
                    title={`${r} / ${c}: ${v}`}
                    className="aspect-square rounded-sm"
                    style={{
                      backgroundColor: `rgba(23,23,23,${0.08 + t * 0.85})`,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const commonAxis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11, fill: "#737373" }}
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
        minTickGap={24}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#737373" }}
        tickLine={false}
        axisLine={false}
        width={40}
      />
      <Tooltip
        contentStyle={{
          borderRadius: 8,
          border: "1px solid #e5e5e5",
          fontSize: 12,
        }}
      />
    </>
  )

  if (chart.type === "line" || chart.type === "multi-line") {
    return (
      <div className="h-[280px] w-full" key={animKey}>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <LineChart
            data={chart.points}
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          >
            {commonAxis}
            {seriesKeys.length > 1 ? (
              <Legend wrapperStyle={{ fontSize: 11 }} />
            ) : null}
            {seriesKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={insightsSeriesColor(i)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
                animationDuration={INSIGHTS_CHART_ANIMATION_MS}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (chart.type === "stacked-area") {
    return (
      <div className="h-[280px] w-full" key={animKey}>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <AreaChart
            data={chart.points}
            stackOffset="expand"
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          >
            {commonAxis}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stackId="1"
                stroke={insightsSeriesColor(i)}
                fill={insightsSeriesColor(i)}
                fillOpacity={0.55}
                isAnimationActive={animate}
                animationDuration={INSIGHTS_CHART_ANIMATION_MS}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (chart.type === "horizontal-bar") {
    const yKey = chart.yKey ?? "label"
    const valueKey = seriesKeys[0] ?? "value"
    return (
      <div className="h-[280px] w-full" key={animKey}>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart
            layout="vertical"
            data={chart.points}
            margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e5e5"
              horizontal={false}
            />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#737373" }} />
            <YAxis
              type="category"
              dataKey={yKey}
              width={90}
              tick={{ fontSize: 11, fill: "#737373" }}
            />
            <Tooltip />
            <Bar
              dataKey={valueKey}
              fill={insightsSeriesColor(0)}
              radius={[0, 4, 4, 0]}
              isAnimationActive={animate}
              animationDuration={INSIGHTS_CHART_ANIMATION_MS}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const stacked = chart.type === "stacked-bar"
  return (
    <div className="h-[280px] w-full" key={animKey}>
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart
          data={chart.points}
          margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
        >
          {commonAxis}
          {seriesKeys.length > 1 ? (
            <Legend wrapperStyle={{ fontSize: 11 }} />
          ) : null}
          {seriesKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId={stacked ? "a" : undefined}
              fill={insightsSeriesColor(i)}
              radius={stacked ? 0 : [4, 4, 0, 0]}
              isAnimationActive={animate}
              animationDuration={INSIGHTS_CHART_ANIMATION_MS}
              animationEasing="ease-out"
            >
              {!stacked && seriesKeys.length === 1
                ? chart.points.map((_, idx) => (
                    <Cell key={idx} fill={insightsSeriesColor(0)} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
