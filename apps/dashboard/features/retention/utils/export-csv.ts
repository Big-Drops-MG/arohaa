import { type CohortMatrix } from "./retention-matrix"

export function exportRetentionCsv(matrix: CohortMatrix, maxWeeks: number = 8) {
  const hasChannel = matrix.length > 0 && matrix[0]?.channel !== undefined

  let csv = hasChannel ? "Cohort,Channel,Total Users" : "Cohort,Total Users"
  for (let i = 0; i <= maxWeeks; i++) {
    csv += `,Week ${i} Users,Week ${i} %`
  }
  csv += "\n"

  matrix.forEach((row) => {
    csv += hasChannel
      ? `${row.cohortWeek},"${row.channel || ""}",${row.totalUsers}`
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

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute(
    "download",
    `cohort-retention-${new Date().toISOString().split("T")[0]}.csv`
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
