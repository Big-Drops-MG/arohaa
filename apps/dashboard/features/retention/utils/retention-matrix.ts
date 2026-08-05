export type CohortRetentionRow = {
  cohort_week: string
  channel?: string
  week_number: number
  active_users: number
}

export type CohortMatrixRow = {
  cohortWeek: string
  channel?: string
  totalUsers: number
  weeks: {
    weekNumber: number
    activeUsers: number | null
    retentionPercent: number
  }[]
}

export type CohortMatrix = CohortMatrixRow[]

export type ChannelRetentionSummary = {
  channel: string
  totalUsers: number
  cohortCount: number
  /** Weighted return rates across cohorts (null = not enough elapsed weeks). */
  week1Percent: number | null
  week2Percent: number | null
  week4Percent: number | null
  week8Percent: number | null
  cohorts: CohortMatrixRow[]
}

export type RetentionSplitBy = "none" | "utm_id" | "utm_source" | "utm_campaign"

export function splitDimensionLabel(splitBy: RetentionSplitBy): string {
  switch (splitBy) {
    case "utm_id":
      return "UTM ID"
    case "utm_source":
      return "Source"
    case "utm_campaign":
      return "Campaign"
    default:
      return "Channel"
  }
}

function fillWeeks(
  cohortWeek: string,
  weekData: Record<number, number>,
  maxWeeks: number
): CohortMatrixRow["weeks"] {
  const totalUsers = weekData[0] || 0
  const weeks: CohortMatrixRow["weeks"] = []
  const now = Date.now()

  for (let i = 0; i <= maxWeeks; i++) {
    let activeUsers: number | null | undefined = weekData[i]

    if (activeUsers === undefined) {
      const cohortDate = new Date(cohortWeek)
      const weekDate = new Date(
        cohortDate.getTime() + i * 7 * 24 * 60 * 60 * 1000
      )
      activeUsers = weekDate.getTime() > now ? null : 0
    }

    let retentionPercent = 0
    if (activeUsers !== null && totalUsers > 0) {
      retentionPercent = (activeUsers / totalUsers) * 100
    }

    weeks.push({
      weekNumber: i,
      activeUsers: activeUsers as number | null,
      retentionPercent,
    })
  }

  return weeks
}

export function buildRetentionMatrix(
  data: CohortRetentionRow[],
  maxWeeks: number = 8
): CohortMatrix {
  const grouped = data.reduce(
    (acc, row) => {
      const key = row.channel
        ? `${row.cohort_week}|${row.channel}`
        : row.cohort_week
      let weekObj = acc[key]
      if (!weekObj) {
        weekObj = {
          cohortWeek: row.cohort_week,
          channel: row.channel,
          weeks: {},
        }
        acc[key] = weekObj
      }
      weekObj.weeks[row.week_number] = row.active_users
      return acc
    },
    {} as Record<
      string,
      { cohortWeek: string; channel?: string; weeks: Record<number, number> }
    >
  )

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const aData = grouped[a]!
    const bData = grouped[b]!
    const weekCmp = bData.cohortWeek.localeCompare(aData.cohortWeek)
    if (weekCmp !== 0) return weekCmp
    return (aData.channel || "").localeCompare(bData.channel || "")
  })

  return sortedKeys.map((key) => {
    const dataObj = grouped[key]!
    const weeks = fillWeeks(dataObj.cohortWeek, dataObj.weeks, maxWeeks)
    return {
      cohortWeek: dataObj.cohortWeek,
      ...(dataObj.channel ? { channel: dataObj.channel } : {}),
      totalUsers: dataObj.weeks[0] || 0,
      weeks,
    }
  })
}

function weightedWeekPercent(
  cohorts: CohortMatrixRow[],
  weekNumber: number
): number | null {
  let returned = 0
  let eligibleUsers = 0

  for (const cohort of cohorts) {
    const week = cohort.weeks.find((w) => w.weekNumber === weekNumber)
    if (!week || week.activeUsers === null) continue
    if (cohort.totalUsers <= 0) continue
    returned += week.activeUsers
    eligibleUsers += cohort.totalUsers
  }

  if (eligibleUsers <= 0) return null
  return (returned / eligibleUsers) * 100
}

/**
 * Roll cohort×channel rows up to one insight row per channel.
 * Better for high-cardinality splits like utm_id (often 1:1 with users).
 */
export function buildChannelRetentionSummary(
  data: CohortRetentionRow[],
  maxWeeks: number = 8
): ChannelRetentionSummary[] {
  const matrix = buildRetentionMatrix(data, maxWeeks)
  const byChannel = new Map<string, CohortMatrixRow[]>()

  for (const row of matrix) {
    const channel = row.channel?.trim() || "Direct"
    const list = byChannel.get(channel)
    if (list) list.push(row)
    else byChannel.set(channel, [row])
  }

  const summaries: ChannelRetentionSummary[] = []

  for (const [channel, cohorts] of byChannel) {
    const totalUsers = cohorts.reduce((sum, c) => sum + c.totalUsers, 0)
    summaries.push({
      channel,
      totalUsers,
      cohortCount: cohorts.length,
      week1Percent: weightedWeekPercent(cohorts, 1),
      week2Percent: weightedWeekPercent(cohorts, 2),
      week4Percent: weightedWeekPercent(cohorts, 4),
      week8Percent: weightedWeekPercent(cohorts, 8),
      cohorts: [...cohorts].sort((a, b) =>
        b.cohortWeek.localeCompare(a.cohortWeek)
      ),
    })
  }

  return summaries.sort((a, b) => {
    if (b.totalUsers !== a.totalUsers) return b.totalUsers - a.totalUsers
    return a.channel.localeCompare(b.channel)
  })
}

export function formatRetentionPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(1)}%`
}
