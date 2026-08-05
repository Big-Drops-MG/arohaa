import {
  type ChannelRetentionSummary,
  type CohortMatrix,
  type RetentionSplitBy,
  splitDimensionLabel,
} from "./retention-matrix"

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportRetentionCsv(matrix: CohortMatrix, maxWeeks: number = 8) {
  const hasChannel = matrix.some((row) => row.channel !== undefined)

  let csv = hasChannel ? "Cohort,Channel,Total Users" : "Cohort,Total Users"
  for (let i = 0; i <= maxWeeks; i++) {
    csv += `,Week ${i} Users,Week ${i} %`
  }
  csv += "\n"

  matrix.forEach((row) => {
    csv += hasChannel
      ? `${row.cohortWeek},"${(row.channel || "").replace(/"/g, '""')}",${row.totalUsers}`
      : `${row.cohortWeek},${row.totalUsers}`

    row.weeks.forEach((w) => {
      if (w.activeUsers === null) {
        csv += `,,`
      } else {
        csv += `,${w.activeUsers},${w.retentionPercent.toFixed(1)}%`
      }
    })
    csv += "\n"
  })

  downloadCsv(`retention-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export function exportChannelRetentionCsv(
  summaries: ChannelRetentionSummary[],
  splitBy: RetentionSplitBy
) {
  const dim = splitDimensionLabel(splitBy)
  let csv = `${dim},Users,Cohorts,Week 1 %,Week 2 %,Week 4 %,Week 8 %\n`

  for (const row of summaries) {
    const fmt = (v: number | null) =>
      v == null || !Number.isFinite(v) ? "" : `${v.toFixed(1)}%`
    csv += `"${row.channel.replace(/"/g, '""')}",${row.totalUsers},${row.cohortCount},${fmt(row.week1Percent)},${fmt(row.week2Percent)},${fmt(row.week4Percent)},${fmt(row.week8Percent)}\n`
  }

  downloadCsv(
    `retention-by-${splitBy}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv
  )
}
