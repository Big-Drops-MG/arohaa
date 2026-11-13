export const CALL_CENTER_CSV_REQUIRED_HEADERS = [
  "Lead ID",
  "SID",
  "TID",
  "Timestamp (EST)",
  "CC Contacted",
  "CC Transferred",
] as const

export type CallCenterCsvRow = {
  externalLeadId: string
  sid: string
  tid: string
  uid: string
  sub1: string
  leadType: string
  state: string
  homeowner: boolean | null
  insured: boolean | null
  vehicles: string
  status: string
  duplicate: boolean
  ccContacted: boolean
  ccDisposition: string
  ccTransferred: boolean
  duration15m: boolean
  duration20m: boolean
  occurredAt: Date | null
}

export type CallCenterSourceRollupRow = {
  sid: string
  leads: number
  contacted: number
  transferred: number
  duration15m: number
  duration20m: number
  duplicates: number
  contactRate: number
  transferRate: number
}

export type CallCenterUploadSummary = {
  id: string
  fileName: string
  rowCount: number
  contactedCount: number
  transferredCount: number
  duplicateCount: number
  createdAt: string
}

export type CallCenterOutcomesPayload = {
  uploads: CallCenterUploadSummary[]
  sources: CallCenterSourceRollupRow[]
  totals: {
    leads: number
    contacted: number
    transferred: number
    duration15m: number
    duration20m: number
    duplicates: number
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ",") {
      cells.push(current)
      current = ""
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

export function parseYesNo(value: string | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase()
  return (
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "true" ||
    normalized === "1"
  )
}

export function parseOptionalBool(value: string | undefined): boolean | null {
  const normalized = (value || "").trim().toLowerCase()
  if (!normalized) return null
  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "1"
  ) {
    return true
  }
  if (
    normalized === "false" ||
    normalized === "no" ||
    normalized === "n" ||
    normalized === "0"
  ) {
    return false
  }
  return null
}

export function parseCallCenterTimestampEst(
  value: string | undefined
): Date | null {
  const raw = (value || "").trim()
  if (!raw) return null
  const match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  )
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }
  const asUtcGuess = Date.UTC(year, month - 1, day, hour, minute, second)
  const approx = new Date(asUtcGuess)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(approx)
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN)
  const shown = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  )
  const desired = Date.UTC(year, month - 1, day, hour, minute, second)
  return new Date(asUtcGuess + (desired - shown))
}

export function normalizeCallCenterSid(sid: string): string {
  const trimmed = sid.trim()
  return trimmed || "—"
}

export function parseCallCenterCsv(text: string): {
  rows: CallCenterCsvRow[]
  errors: string[]
} {
  const errors: string[] = []
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV has no data rows."] }
  }

  const headers = parseCsvLine(lines[0]!)
  const index = new Map(headers.map((header, i) => [header, i]))
  for (const required of CALL_CENTER_CSV_REQUIRED_HEADERS) {
    if (!index.has(required)) {
      errors.push(`Missing required column: ${required}`)
    }
  }
  if (errors.length > 0) return { rows: [], errors }

  const get = (cells: string[], name: string) => {
    const i = index.get(name)
    return i == null ? "" : (cells[i] ?? "").trim()
  }

  const rows: CallCenterCsvRow[] = []
  for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
    const cells = parseCsvLine(lines[lineNo]!)
    const externalLeadId = get(cells, "Lead ID")
    if (!externalLeadId) {
      errors.push(`Row ${lineNo + 1}: missing Lead ID`)
      continue
    }
    rows.push({
      externalLeadId,
      sid: get(cells, "SID"),
      tid: get(cells, "TID"),
      uid: get(cells, "UID"),
      sub1: get(cells, "Sub1"),
      leadType: get(cells, "Lead Type"),
      state: get(cells, "State"),
      homeowner: parseOptionalBool(get(cells, "Homeowner")),
      insured: parseOptionalBool(get(cells, "Insured?")),
      vehicles: get(cells, "Vehicles"),
      status: get(cells, "Status"),
      duplicate: parseYesNo(get(cells, "Duplicate")),
      ccContacted: parseYesNo(get(cells, "CC Contacted")),
      ccDisposition: get(cells, "CC Disposition"),
      ccTransferred: parseYesNo(get(cells, "CC Transferred")),
      duration15m: parseYesNo(get(cells, "15m+ Duration")),
      duration20m: parseYesNo(get(cells, "20m+ Duration")),
      occurredAt: parseCallCenterTimestampEst(get(cells, "Timestamp (EST)")),
    })
  }

  return { rows, errors }
}

export function computeCallCenterSourceRollups(
  rows: CallCenterCsvRow[]
): CallCenterSourceRollupRow[] {
  const buckets = new Map<
    string,
    {
      leads: number
      contacted: number
      transferred: number
      duration15m: number
      duration20m: number
      duplicates: number
    }
  >()

  for (const row of rows) {
    const sid = normalizeCallCenterSid(row.sid)
    let bucket = buckets.get(sid)
    if (!bucket) {
      bucket = {
        leads: 0,
        contacted: 0,
        transferred: 0,
        duration15m: 0,
        duration20m: 0,
        duplicates: 0,
      }
      buckets.set(sid, bucket)
    }
    bucket.leads += 1
    if (row.ccContacted) bucket.contacted += 1
    if (row.ccTransferred) bucket.transferred += 1
    if (row.duration15m) bucket.duration15m += 1
    if (row.duration20m) bucket.duration20m += 1
    if (row.duplicate) bucket.duplicates += 1
  }

  return [...buckets.entries()]
    .map(([sid, bucket]) => ({
      sid,
      ...bucket,
      contactRate: bucket.leads > 0 ? bucket.contacted / bucket.leads : 0,
      transferRate: bucket.leads > 0 ? bucket.transferred / bucket.leads : 0,
    }))
    .sort((a, b) => b.leads - a.leads || a.sid.localeCompare(b.sid))
}
