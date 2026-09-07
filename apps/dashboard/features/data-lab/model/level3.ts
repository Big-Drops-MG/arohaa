import type { DataExportLeadRow } from "@/features/data-export/model/data-export"
import type {
  IntelligenceBoard,
  IntelligenceCenterPayload,
  IntelligenceWinner,
} from "./intelligence"
import { ageGroupFromAge, parseLeadWhen } from "./level1"
import {
  getDashboardTimezoneAbbreviation,
  getDashboardZonedParts,
} from "@/lib/datetime"
import { normalizeUsStateName } from "@/features/overview/model/us-states"

const LEVEL3_MIN_SAMPLE = 6

type Level3BucketCounter = {
  label: string
  total: number
  submitted: number
}

type Level3BucketRow = Level3BucketCounter & {
  submissionRate: number
  shareOfSubmitted: number
  credibleScore: number
}

function calculateCredibleRate(
  submitted: number,
  total: number,
  z = 1.64
): number {
  if (total <= 0 || submitted <= 0) return 0
  const p = submitted / total
  const z2 = z * z
  const denominator = 1 + z2 / total
  const centerAdjusted = p + z2 / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)
  return Math.max(0, (centerAdjusted - margin) / denominator)
}

function formatPercentShare(part: number, total: number): string {
  if (total <= 0) return "0%"
  const pct = (part / total) * 100
  const rounded =
    Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toFixed(1).replace(/\.0$/, "")
  return `${rounded}%`
}

function formatHourWindow(hour: number, sampleDate: Date): string {
  const formatHour = (value: number) => {
    const normalized = ((value % 24) + 24) % 24
    const suffix = normalized >= 12 ? "PM" : "AM"
    const displayHour = normalized % 12 || 12
    return `${displayHour}:00 ${suffix}`
  }
  const zone = getDashboardTimezoneAbbreviation(sampleDate)
  return `${formatHour(hour)} – ${formatHour(hour + 1)} ${zone}`
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function emptyLevel3Payload(): IntelligenceCenterPayload {
  return { section: "level3", winners: [], boards: [], actions: [] }
}

function pickFieldValue(
  fields: Record<string, string> | null | undefined,
  keys: string[]
): string | null {
  if (!fields) return null
  const byLower = new Map<string, string>()
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = String(value ?? "").trim()
    if (!trimmed) continue
    byLower.set(key.trim().toLowerCase(), trimmed)
  }
  for (const key of keys) {
    const value = byLower.get(key.toLowerCase())
    if (value) return value
  }
  return null
}

function parseDobParts(
  raw: string
): { month: number; day: number; year: number } | null {
  const match = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900
  ) {
    return null
  }
  return { month, day, year }
}

function ageFromDob(
  raw: string | null | undefined,
  now: { year: number; month: number; day: number }
): number | null {
  if (!raw?.trim()) return null
  const parts = parseDobParts(raw)
  if (!parts) return null
  let age = now.year - parts.year
  if (
    now.month < parts.month ||
    (now.month === parts.month && now.day < parts.day)
  ) {
    age -= 1
  }
  if (age < 0 || age > 120) return null
  return age
}

function resolveLeadAge(
  fields: Record<string, string> | null | undefined,
  now: { year: number; month: number; day: number }
): number | null {
  const dob = pickFieldValue(fields, ["dob"])
  const fromDob = ageFromDob(dob, now)
  if (fromDob != null) return fromDob

  const rawAge = pickFieldValue(fields, ["driver_0_age", "age"])
  if (!rawAge) return null
  const age = Number(rawAge.replace(/\D/g, ""))
  if (!Number.isFinite(age) || age < 0 || age > 120) return null
  return age
}

function normalizeSource(value: string): string {
  const trimmed = value.trim()
  return trimmed || "(direct)"
}

function normalizeVehicleMake(value: string): string {
  const map: Record<string, string> = {
    ACU: "Acura",
    ALF: "Alfa Romeo",
    AMC: "AMC",
    AST: "Aston Martin",
    AUD: "Audi",
    BEN: "Bentley",
    BMW: "BMW",
    BUI: "Buick",
    CAD: "Cadillac",
    CHE: "Chevrolet",
    CHR: "Chrysler",
    DOD: "Dodge",
    FOR: "Ford",
    GMC: "GMC",
    HON: "Honda",
    HYU: "Hyundai",
    JEE: "Jeep",
    KIA: "Kia",
    LEX: "Lexus",
    MAZ: "Mazda",
    MEC: "Mercedes-Benz",
    MIN: "MINI",
    NIS: "Nissan",
    RAM: "Ram",
    SUB: "Subaru",
    TES: "Tesla",
    TOY: "Toyota",
    VOL: "Volvo",
    VW: "Volkswagen",
  }
  return map[value.trim().toUpperCase()] ?? value
}

function hasVisibleLeadField(
  visibleLeadFieldKeys: string[],
  candidates: string[]
): boolean {
  const visible = new Set(
    visibleLeadFieldKeys.map((key) => key.trim().toLowerCase())
  )
  return candidates.some((candidate) => visible.has(candidate.toLowerCase()))
}

function addBucket(
  counts: Map<string, Level3BucketCounter>,
  label: string,
  submitted: boolean
): void {
  const next = counts.get(label) ?? { label, total: 0, submitted: 0 }
  next.total += 1
  if (submitted) next.submitted += 1
  counts.set(label, next)
}

function finalizeBuckets(
  counts: Map<string, Level3BucketCounter>
): Level3BucketRow[] {
  const rows = [...counts.values()]
  const totalSubmitted = rows.reduce((sum, row) => sum + row.submitted, 0)

  return rows
    .map((row) => {
      const submissionRate =
        row.total > 0 ? round1((row.submitted / row.total) * 100) : 0
      const shareOfSubmitted =
        totalSubmitted > 0 ? round1((row.submitted / totalSubmitted) * 100) : 0
      const credibleScore = calculateCredibleRate(row.submitted, row.total)
      return {
        ...row,
        submissionRate,
        shareOfSubmitted,
        credibleScore,
      }
    })
    .sort((a, b) => {
      // Prefer buckets with enough sample for a reliable read, then Wilson score.
      // This keeps tiny 100% cells from beating real volume, without letting a
      // weak large bucket (e.g. 3/8) outrank a stronger mid-size bucket (e.g. 5/6).
      const aQualified = a.total >= LEVEL3_MIN_SAMPLE && a.submitted > 0 ? 1 : 0
      const bQualified = b.total >= LEVEL3_MIN_SAMPLE && b.submitted > 0 ? 1 : 0
      if (bQualified !== aQualified) return bQualified - aQualified
      return (
        b.credibleScore - a.credibleScore ||
        b.submitted - a.submitted ||
        b.submissionRate - a.submissionRate ||
        b.total - a.total ||
        a.label.localeCompare(b.label)
      )
    })
}

function rankDimension(
  leads: DataExportLeadRow[],
  readLabel: (lead: DataExportLeadRow) => string | null
): Level3BucketRow[] {
  const counts = new Map<string, Level3BucketCounter>()
  for (const lead of leads) {
    const label = readLabel(lead)
    if (!label) continue
    addBucket(counts, label, lead.formSubmitted)
  }
  return finalizeBuckets(counts)
}

function rankPairs(
  leads: DataExportLeadRow[],
  readLeft: (lead: DataExportLeadRow) => string | null,
  readRight: (lead: DataExportLeadRow) => string | null
): Level3BucketRow[] {
  const counts = new Map<string, Level3BucketCounter>()
  for (const lead of leads) {
    const left = readLeft(lead)
    const right = readRight(lead)
    if (!left || !right) continue
    addBucket(counts, `${left} x ${right}`, lead.formSubmitted)
  }
  return finalizeBuckets(counts)
}

function pickWinner(rows: Level3BucketRow[]): Level3BucketRow | null {
  if (rows.length === 0) return null
  const qualified = rows.filter(
    (row) => row.total >= LEVEL3_MIN_SAMPLE && row.submitted > 0
  )
  if (qualified.length > 0) return qualified[0]!

  const withConversions = rows.filter((row) => row.submitted > 0)
  if (withConversions.length > 0) return withConversions[0]!

  return rows[0] ?? null
}

function createWinnerCard(
  id: string,
  label: string,
  rows: Level3BucketRow[]
): IntelligenceWinner {
  const best = pickWinner(rows)
  return {
    id,
    label,
    value: best?.label ?? "—",
    metricLabel: "Submitted leads",
    metricValue: best?.submitted ?? 0,
    secondaryLabel: "Submission rate",
    secondaryValue: best
      ? `${formatPercentShare(best.submissionRate, 100)} (${best.submitted}/${best.total} leads)`
      : "—",
    sampleSize: best?.total ?? 0,
    enoughData: Boolean(
      best && best.total >= LEVEL3_MIN_SAMPLE && best.submitted > 0
    ),
  }
}

function createBoard(
  id: string,
  title: string,
  rows: Level3BucketRow[],
  options?: { includeShare?: boolean; limit?: number; takeawayPrefix?: string }
): IntelligenceBoard {
  const includeShare = options?.includeShare === true
  const limit = options?.limit ?? 6
  const best = pickWinner(rows)

  return {
    id,
    title,
    columns: [
      { key: "total", label: "Total leads" },
      { key: "submitted", label: "Submitted leads" },
      { key: "submissionRate", label: "Submission rate" },
      ...(includeShare
        ? [{ key: "shareOfSubmitted", label: "Share of submitted leads" }]
        : []),
    ],
    rows: rows.slice(0, limit).map((row) => ({
      label: row.label,
      values: {
        total: row.total,
        submitted: row.submitted,
        submissionRate: formatPercentShare(row.submissionRate, 100),
        ...(includeShare
          ? { shareOfSubmitted: formatPercentShare(row.shareOfSubmitted, 100) }
          : {}),
      },
    })),
    takeaway:
      !best || best.submitted === 0
        ? "Not enough data yet to identify a clear efficiency winner."
        : `${options?.takeawayPrefix ?? best.label} is converting best in this range at ${formatPercentShare(best.submissionRate, 100)} with ${best.submitted} submissions from ${best.total.toLocaleString()} leads.`,
  }
}

function createGapCard(rows: Level3BucketRow[]): IntelligenceWinner {
  const volumeLeader = [...rows].sort(
    (a, b) =>
      b.submitted - a.submitted ||
      b.total - a.total ||
      b.submissionRate - a.submissionRate
  )[0]
  const efficiencyLeader = pickWinner(rows)
  if (!volumeLeader || !efficiencyLeader) {
    return {
      id: "volume-vs-efficiency-gap",
      label: "Largest Volume vs Best Efficiency Gap",
      value: "—",
      metricLabel: "Gap (pp)",
      metricValue: 0,
      sampleSize: 0,
      enoughData: false,
    }
  }

  const sameLeader = volumeLeader.label === efficiencyLeader.label
  if (sameLeader) {
    return {
      id: "volume-vs-efficiency-gap",
      label: "Volume & Efficiency Leader",
      value: volumeLeader.label,
      metricLabel: "Submitted leads",
      metricValue: volumeLeader.submitted,
      secondaryLabel: "Submission rate",
      secondaryValue: `${formatPercentShare(volumeLeader.submissionRate, 100)} (${volumeLeader.submitted}/${volumeLeader.total} leads)`,
      sampleSize: volumeLeader.total,
      enoughData:
        volumeLeader.total >= LEVEL3_MIN_SAMPLE && volumeLeader.submitted > 0,
    }
  }

  const gap = Math.max(
    0,
    round1(efficiencyLeader.submissionRate - volumeLeader.submissionRate)
  )
  return {
    id: "volume-vs-efficiency-gap",
    label: "Largest Volume vs Best Efficiency Gap",
    value: `${volumeLeader.label} vs ${efficiencyLeader.label}`,
    metricLabel: "Gap (pp)",
    metricValue: gap,
    secondaryLabel: "Efficiency leader rate",
    secondaryValue: `${formatPercentShare(efficiencyLeader.submissionRate, 100)} (${efficiencyLeader.submitted}/${efficiencyLeader.total})`,
    sampleSize: Math.max(volumeLeader.total, efficiencyLeader.total),
    enoughData:
      volumeLeader.total >= LEVEL3_MIN_SAMPLE &&
      efficiencyLeader.total >= LEVEL3_MIN_SAMPLE,
  }
}

const LEVEL3_MAX_PAIR_BOARDS = 10

type Level3DimId = "source" | "time" | "state" | "age" | "make" | "gender"

type Level3Dimension = {
  id: Level3DimId
  available: boolean
  rows: Level3BucketRow[]
  read: (lead: DataExportLeadRow) => string | null
}

type Level3PairSpec = {
  left: Level3DimId
  right: Level3DimId
  winnerId: string
  winnerLabel: string
  boardId: string
  boardTitle: string
}

const LEVEL3_PAIR_SPECS: Level3PairSpec[] = [
  {
    left: "source",
    right: "age",
    winnerId: "best-converting-source-age-group",
    winnerLabel: "Best Converting Source x Age Group",
    boardId: "source-age-performance",
    boardTitle: "Source x Age Group",
  },
  {
    left: "source",
    right: "state",
    winnerId: "best-converting-source-state",
    winnerLabel: "Best Converting Source x State",
    boardId: "source-state-performance",
    boardTitle: "Source x State",
  },
  {
    left: "source",
    right: "make",
    winnerId: "best-converting-source-make",
    winnerLabel: "Best Converting Source x Vehicle Make",
    boardId: "source-make-performance",
    boardTitle: "Source x Vehicle Make",
  },
  {
    left: "source",
    right: "time",
    winnerId: "best-converting-source-time",
    winnerLabel: "Best Converting Source x Time Window",
    boardId: "source-time-performance",
    boardTitle: "Source x Time Window",
  },
  {
    left: "source",
    right: "gender",
    winnerId: "best-converting-source-gender",
    winnerLabel: "Best Converting Source x Gender",
    boardId: "source-gender-performance",
    boardTitle: "Source x Gender",
  },
  {
    left: "age",
    right: "state",
    winnerId: "best-converting-age-state",
    winnerLabel: "Best Converting Age Group x State",
    boardId: "age-state-performance",
    boardTitle: "Age Group x State",
  },
  {
    left: "make",
    right: "age",
    winnerId: "best-converting-make-age",
    winnerLabel: "Best Converting Vehicle Make x Age Group",
    boardId: "make-age-performance",
    boardTitle: "Vehicle Make x Age Group",
  },
  {
    left: "make",
    right: "state",
    winnerId: "best-converting-make-state",
    winnerLabel: "Best Converting Vehicle Make x State",
    boardId: "make-state-performance",
    boardTitle: "Vehicle Make x State",
  },
  {
    left: "time",
    right: "state",
    winnerId: "best-converting-time-state",
    winnerLabel: "Best Converting Time Window x State",
    boardId: "time-state-performance",
    boardTitle: "Time Window x State",
  },
  {
    left: "time",
    right: "age",
    winnerId: "best-converting-time-age",
    winnerLabel: "Best Converting Time Window x Age Group",
    boardId: "time-age-performance",
    boardTitle: "Time Window x Age Group",
  },
]

function findGenderFieldKey(visibleLeadFieldKeys: string[]): string | null {
  for (const key of visibleLeadFieldKeys) {
    const trimmed = key.trim()
    if (/gender|sex|^driver_\d+_gender$/i.test(trimmed)) return trimmed
  }
  return null
}

function canonicalizeGender(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  if (["male", "m"].includes(value)) return "Male"
  if (["female", "f"].includes(value)) return "Female"
  return null
}

function findMakeFieldKeys(visibleLeadFieldKeys: string[]): string[] {
  const preferred = ["car_0_make", "vehicle_0_make"]
  const fromVisible = visibleLeadFieldKeys.filter((key) =>
    /(?:^|_)(?:make|manufacturer)$/i.test(key.trim())
  )
  return [...new Set([...preferred, ...fromVisible])]
}

function buildLevel3Dimensions(
  leads: DataExportLeadRow[],
  visibleLeadFieldKeys: string[]
): Record<Level3DimId, Level3Dimension> {
  const now = getDashboardZonedParts(new Date())
  const genderKey = findGenderFieldKey(visibleLeadFieldKeys)
  const makeKeys = findMakeFieldKeys(visibleLeadFieldKeys)
  const canUseState = hasVisibleLeadField(visibleLeadFieldKeys, ["state"])
  const canUseAge = hasVisibleLeadField(visibleLeadFieldKeys, [
    "dob",
    "age",
    "driver_0_age",
  ])
  const canUseMake = visibleLeadFieldKeys.some((key) =>
    /(?:^|_)(?:make|manufacturer)$/i.test(key.trim())
  )

  const readSource = (lead: DataExportLeadRow) =>
    normalizeSource(lead.utmSource)
  const readTime = (lead: DataExportLeadRow) => {
    const when = parseLeadWhen(lead.createdAt)
    if (!when) return null
    return formatHourWindow(getDashboardZonedParts(when).hour, when)
  }
  const readState = (lead: DataExportLeadRow) => {
    const stateRaw = pickFieldValue(lead.fields, ["state"])
    return stateRaw ? (normalizeUsStateName(stateRaw) ?? stateRaw) : null
  }
  const readAge = (lead: DataExportLeadRow) => {
    const age = resolveLeadAge(lead.fields, now)
    return age != null ? ageGroupFromAge(age) : null
  }
  const readMake = (lead: DataExportLeadRow) => {
    const make = pickFieldValue(lead.fields, makeKeys)
    return make ? normalizeVehicleMake(make) : null
  }
  const readGender = (lead: DataExportLeadRow) => {
    if (!genderKey) return null
    const raw = pickFieldValue(lead.fields, [genderKey])
    return raw ? canonicalizeGender(raw) : null
  }

  const sourceRows = rankDimension(leads, readSource)
  const timeRows = rankDimension(leads, readTime)
  const stateRows = canUseState ? rankDimension(leads, readState) : []
  const ageRows = canUseAge ? rankDimension(leads, readAge) : []
  const makeRows = canUseMake ? rankDimension(leads, readMake) : []
  const genderRows = genderKey != null ? rankDimension(leads, readGender) : []

  return {
    source: {
      id: "source",
      available: sourceRows.length > 0,
      rows: sourceRows,
      read: readSource,
    },
    time: {
      id: "time",
      available: timeRows.length > 0,
      rows: timeRows,
      read: readTime,
    },
    state: {
      id: "state",
      available: canUseState && stateRows.length > 0,
      rows: stateRows,
      read: readState,
    },
    age: {
      id: "age",
      available: canUseAge && ageRows.length > 0,
      rows: ageRows,
      read: readAge,
    },
    make: {
      id: "make",
      available: canUseMake && makeRows.length > 0,
      rows: makeRows,
      read: readMake,
    },
    gender: {
      id: "gender",
      available: genderKey != null && genderRows.length > 0,
      rows: genderRows,
      read: readGender,
    },
  }
}

function createActions(input: {
  bestSource: IntelligenceWinner
  bestState: IntelligenceWinner | null
  bestSourceAge: IntelligenceWinner | null
  bestSourceMake: IntelligenceWinner | null
  bestSourceTime: IntelligenceWinner | null
  bestAgeState: IntelligenceWinner | null
  gap: IntelligenceWinner
}): string[] {
  const actions: string[] = []

  if (input.bestSource.enoughData && input.bestSource.value !== "—") {
    actions.push(
      `Scale spend on ${input.bestSource.value}: It is your highest-efficiency acquisition channel converting at ${input.bestSource.secondaryValue}.`
    )
  }
  if (input.bestSourceAge?.enoughData && input.bestSourceAge.value !== "—") {
    actions.push(
      `Prioritize the ${input.bestSourceAge.value} audience: This source and age group combination delivers your top conversion performance (${input.bestSourceAge.secondaryValue}).`
    )
  }
  if (input.bestSourceMake?.enoughData && input.bestSourceMake.value !== "—") {
    actions.push(
      `Align creative to ${input.bestSourceMake.value}: This source and vehicle make combination leads conversion efficiency (${input.bestSourceMake.secondaryValue}).`
    )
  }
  if (input.bestSourceTime?.enoughData && input.bestSourceTime.value !== "—") {
    actions.push(
      `Schedule more budget into ${input.bestSourceTime.value}: Highest-efficiency source and daypart combination (${input.bestSourceTime.secondaryValue}).`
    )
  }
  if (input.bestAgeState?.enoughData && input.bestAgeState.value !== "—") {
    actions.push(
      `Target ${input.bestAgeState.value}: This age group and state combination converts best (${input.bestAgeState.secondaryValue}).`
    )
  }
  if (input.bestState?.enoughData && input.bestState.value !== "—") {
    actions.push(
      `Lean budget toward ${input.bestState.value}: Leading all geographic regions on submission efficiency (${input.bestState.secondaryValue}).`
    )
  }
  if (input.gap.enoughData) {
    if (input.gap.label === "Volume & Efficiency Leader") {
      actions.push(
        `${input.gap.value} captures both your largest lead volume and highest conversion efficiency — a strong signal to scale ad spend with high confidence.`
      )
    } else if (input.gap.value.includes(" vs ")) {
      actions.push(
        `Review traffic distribution between ${input.gap.value}: The efficiency leader outperforms your top volume channel by +${input.gap.metricValue}% conversion rate.`
      )
    }
  }

  return actions.slice(0, 4)
}

export function computeLevel3FromLeads(
  leads: DataExportLeadRow[],
  visibleLeadFieldKeys: string[]
): IntelligenceCenterPayload {
  if (leads.length === 0) return emptyLevel3Payload()

  const dims = buildLevel3Dimensions(leads, visibleLeadFieldKeys)

  const pairResults: Array<{
    spec: Level3PairSpec
    rows: Level3BucketRow[]
    winner: IntelligenceWinner
    board: IntelligenceBoard
  }> = []

  for (const spec of LEVEL3_PAIR_SPECS) {
    const left = dims[spec.left]
    const right = dims[spec.right]
    if (!left.available || !right.available) continue
    const rows = rankPairs(leads, left.read, right.read)
    if (rows.length === 0) continue
    pairResults.push({
      spec,
      rows,
      winner: createWinnerCard(spec.winnerId, spec.winnerLabel, rows),
      board: createBoard(spec.boardId, spec.boardTitle, rows, { limit: 8 }),
    })
  }

  const cappedPairs = pairResults.slice(0, LEVEL3_MAX_PAIR_BOARDS)
  const winnerById = new Map(
    cappedPairs.map((pair) => [pair.spec.winnerId, pair.winner])
  )

  const bestSource = createWinnerCard(
    "best-converting-source",
    "Best Converting Source",
    dims.source.rows
  )
  const bestState = dims.state.available
    ? createWinnerCard(
        "best-converting-state",
        "Best Converting State",
        dims.state.rows
      )
    : null
  const bestAge = dims.age.available
    ? createWinnerCard(
        "best-converting-age-group",
        "Best Converting Age Group",
        dims.age.rows
      )
    : null
  const bestMake = dims.make.available
    ? createWinnerCard(
        "best-converting-vehicle-make",
        "Best Converting Vehicle Make",
        dims.make.rows
      )
    : null
  const bestTime = createWinnerCard(
    "most-efficient-time-window",
    "Most Efficient Time Window",
    dims.time.rows
  )
  const gap = createGapCard(dims.source.rows)

  const pairWinners = cappedPairs.map((pair) => pair.winner)

  return {
    section: "level3",
    winners: [
      bestSource,
      ...(bestState ? [bestState] : []),
      ...(bestAge ? [bestAge] : []),
      ...pairWinners,
      ...(bestMake ? [bestMake] : []),
      bestTime,
      gap,
    ],
    boards: [
      createBoard(
        "source-performance",
        "Source Performance",
        dims.source.rows,
        {
          includeShare: true,
        }
      ),
      ...(dims.state.available
        ? [
            createBoard(
              "state-performance",
              "State Performance",
              dims.state.rows,
              { includeShare: true }
            ),
          ]
        : []),
      ...cappedPairs.map((pair) => pair.board),
    ],
    actions: createActions({
      bestSource,
      bestState,
      bestSourceAge: winnerById.get("best-converting-source-age-group") ?? null,
      bestSourceMake: winnerById.get("best-converting-source-make") ?? null,
      bestSourceTime: winnerById.get("best-converting-source-time") ?? null,
      bestAgeState: winnerById.get("best-converting-age-state") ?? null,
      gap,
    }),
  }
}

export function hasCompleteLevel3Stats(
  payload: IntelligenceCenterPayload | null | undefined
): boolean {
  if (!payload || payload.section !== "level3") return false
  return (
    Array.isArray(payload.winners) &&
    payload.winners.length > 0 &&
    Array.isArray(payload.boards) &&
    payload.boards.length > 0
  )
}

export function resolveLevel3Stats(
  level3: IntelligenceCenterPayload | null | undefined,
  leads: DataExportLeadRow[],
  visibleLeadFieldKeys: string[],
  completeFromApi: boolean
): { payload: IntelligenceCenterPayload; complete: boolean } {
  if (completeFromApi && hasCompleteLevel3Stats(level3)) {
    return { payload: level3!, complete: true }
  }
  return {
    payload: computeLevel3FromLeads(leads, visibleLeadFieldKeys),
    complete: false,
  }
}
