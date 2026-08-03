export type CohortRetentionRow = {
  cohort_week: string
  channel?: string
  week_number: number
  active_users: number
}

export type CohortMatrix = {
  cohortWeek: string
  channel?: string
  totalUsers: number
  weeks: {
    weekNumber: number
    activeUsers: number | null
    retentionPercent: number
  }[]
}[]

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
    const weekData = dataObj.weeks
    const totalUsers = weekData[0] || 0

    const weeks = []
    for (let i = 0; i <= maxWeeks; i++) {
      let activeUsers: number | null | undefined = weekData[i]

      if (activeUsers === undefined) {
        // Compare dates to see if the week is in the future
        const cohortDate = new Date(dataObj.cohortWeek)
        const weekDate = new Date(
          cohortDate.getTime() + i * 7 * 24 * 60 * 60 * 1000
        )
        if (weekDate > new Date()) {
          activeUsers = null // Future week
        } else {
          activeUsers = 0 // Past week, but exactly 0 users returned
        }
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

    return {
      cohortWeek: dataObj.cohortWeek,
      ...(dataObj.channel ? { channel: dataObj.channel } : {}),
      totalUsers,
      weeks,
    }
  })
}
