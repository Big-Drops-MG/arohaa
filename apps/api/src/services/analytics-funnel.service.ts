import {
  previousRangeFilter,
  rangeFilter,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import { computePeriodChangePct } from '../lib/funnel-trend.js'
import { TtlMemoryCache } from '../lib/ttl-memory-cache.js'
import { getClickHouseClient } from './clickhouse.service.js'
import type {
  FunnelDashboardResponse,
  FunnelDropOffRow,
  FunnelMetricRow,
  FunnelMultiStepRow,
} from '../types/analytics-funnel.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round2 = (v: number) => Math.round(v * 100) / 100

const FIELD_NAME_EXPR = `JSONExtractString(properties, 'fieldName')`
const STEP_INDEX_EXPR = `toUInt8(JSONExtractUInt(properties, 'stepIndex'))`

type CoreFunnelRow = {
  page_views: string
  interactions: string
  form_started: string
  form_submitted: string
  zip_started: string
  zip_submitted: string
}

export type FunnelFormType = 'zip' | 'single' | 'multiple'

function coreFunnelQuery(whereClause: string): string {
  return `
    SELECT
      countIf(event_name = 'page_view') AS page_views,
      uniqExactIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
      uniqExactIf(session_id, event_name = 'form_start') AS form_started,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
      uniqExactIf(session_id, event_name = 'zip_start') AS zip_started,
      uniqExactIf(session_id, event_name = 'zip_submit') AS zip_submitted
    FROM events
    WHERE ${whereClause}
  `
}

type StepAggRow = {
  step_index: string
  sessions: string
}

function multiStepQuery(whereClause: string): string {
  return `
    SELECT
      step_index,
      uniqExact(session_id) AS sessions
    FROM (
      SELECT
        session_id,
        ${STEP_INDEX_EXPR} AS step_index
      FROM events
      WHERE ${whereClause}
        AND event_name = 'form_step_view'
        AND ${STEP_INDEX_EXPR} > 0
    )
    GROUP BY step_index
    ORDER BY step_index ASC
  `
}

type DropOffAggRow = {
  field_name: string
  drop_offs: string
  reached: string
}

function dropOffQuery(whereClause: string): string {
  return `
    SELECT
      field_name,
      uniqExactIf(session_id, event_name = 'form_field_abandon') AS drop_offs,
      uniqExactIf(session_id, event_name = 'form_field_focus') AS reached
    FROM (
      SELECT
        session_id,
        event_name,
        ${FIELD_NAME_EXPR} AS field_name
      FROM events
      WHERE ${whereClause}
        AND event_name IN ('form_field_abandon', 'form_field_focus')
        AND ${FIELD_NAME_EXPR} != ''
    )
    GROUP BY field_name
    HAVING reached > 0
    ORDER BY drop_offs DESC
    LIMIT 20
  `
}

function parseCoreFunnel(row: CoreFunnelRow | undefined) {
  return {
    pageViews: n(row?.page_views),
    interactions: n(row?.interactions),
    formStarted: n(row?.form_started),
    formSubmitted: n(row?.form_submitted),
    zipStarted: n(row?.zip_started),
    zipSubmitted: n(row?.zip_submitted),
  }
}

function buildMetrics(
  current: ReturnType<typeof parseCoreFunnel>,
  previous: ReturnType<typeof parseCoreFunnel>,
  formType: FunnelFormType,
): FunnelMetricRow[] {
  const isZip = formType === 'zip'

  const startedCur = isZip
    ? current.zipStarted || current.formStarted
    : current.formStarted
  const startedPrev = isZip
    ? previous.zipStarted || previous.formStarted
    : previous.formStarted

  const submittedCur = isZip
    ? current.zipSubmitted || current.formSubmitted
    : current.formSubmitted
  const submittedPrev = isZip
    ? previous.zipSubmitted || previous.formSubmitted
    : previous.formSubmitted

  const defs = [
    { label: 'Landing Page Visits', cur: current.pageViews, prev: previous.pageViews },
    { label: 'Interactions', cur: current.interactions, prev: previous.interactions },
    { label: 'Form Started', cur: startedCur, prev: startedPrev },
    { label: 'Form Submitted', cur: submittedCur, prev: submittedPrev },
  ]

  return defs.map(({ label, cur, prev }) => ({
    label,
    count: cur,
    changePct: computePeriodChangePct(cur, prev),
  }))
}

function buildMultiStepSteps(
  currentSteps: StepAggRow[],
  previousSteps: StepAggRow[],
  currentCore: ReturnType<typeof parseCoreFunnel>,
  previousCore: ReturnType<typeof parseCoreFunnel>,
): FunnelMultiStepRow[] {
  const curMap = new Map(currentSteps.map(r => [n(r.step_index), n(r.sessions)]))
  const prevMap = new Map(previousSteps.map(r => [n(r.step_index), n(r.sessions)]))

  const maxStep = Math.max(
    0,
    ...curMap.keys(),
    ...prevMap.keys(),
    currentSteps.length > 0 ? 0 : 1,
  )

  const steps: FunnelMultiStepRow[] = []

  if (curMap.size === 0 && prevMap.size === 0) {
    const fallbackSteps = [
      { label: 'Step 1', cur: currentCore.formStarted, prev: previousCore.formStarted },
      { label: 'Step 2', cur: 0, prev: 0 },
      { label: 'Step 3', cur: 0, prev: 0 },
    ]
    for (const step of fallbackSteps) {
      steps.push({
        label: step.label,
        count: step.cur,
        changePct: computePeriodChangePct(step.cur, step.prev),
      })
    }
  } else {
    const stepCount = Math.max(maxStep, 3)
    for (let i = 1; i <= stepCount; i++) {
      const cur = curMap.get(i) ?? 0
      const prev = prevMap.get(i) ?? 0
      steps.push({
        label: `Step ${i}`,
        count: cur,
        changePct: computePeriodChangePct(cur, prev),
      })
    }
  }

  steps.push({
    label: 'Final Submit',
    count: currentCore.formSubmitted,
    changePct: computePeriodChangePct(
      currentCore.formSubmitted,
      previousCore.formSubmitted,
    ),
  })

  return steps
}

function buildDropOffRows(rows: DropOffAggRow[]): FunnelDropOffRow[] {
  const parsed = rows.map(row => {
    const dropOffs = n(row.drop_offs)
    const reached = n(row.reached)
    const percentDrop = reached > 0 ? round2((dropOffs / reached) * 100) : 0
    return {
      fieldName: row.field_name,
      dropOffs,
      percentDrop,
      emphasized: false,
    }
  })

  if (parsed.length === 0) return []

  const maxPct = Math.max(...parsed.map(r => r.percentDrop))
  return parsed.map(row => ({
    ...row,
    emphasized: row.percentDrop === maxPct && maxPct > 0,
  }))
}

export interface GetAnalyticsFunnelParams {
  workspaceId: string
  rangeId: AnalyticsRangeId
  formType?: FunnelFormType
}

const FUNNEL_RESPONSE_CACHE = new TtlMemoryCache<FunnelDashboardResponse>(45_000)

export async function getAnalyticsFunnel({
  workspaceId,
  rangeId,
  formType = 'single',
}: GetAnalyticsFunnelParams): Promise<FunnelDashboardResponse> {
  const cacheKey = `${workspaceId}:${rangeId}:${formType}`
  const cached = FUNNEL_RESPONSE_CACHE.get(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const p = { wid: workspaceId }
  const q = (query: string) => ch.query({ format: 'JSON', query_params: p, query })

  const currentWhere = rangeFilter(rangeId)
  const previousWhere = previousRangeFilter(rangeId)

  const [
    currentCoreRes,
    previousCoreRes,
    currentStepsRes,
    previousStepsRes,
    dropOffRes,
  ] = await Promise.all([
    q(coreFunnelQuery(currentWhere)),
    q(coreFunnelQuery(previousWhere)),
    q(multiStepQuery(currentWhere)),
    q(multiStepQuery(previousWhere)),
    q(dropOffQuery(currentWhere)),
  ])

  const currentCore = parseCoreFunnel(
    ((await currentCoreRes.json()) as CHJson<CoreFunnelRow>).data[0],
  )
  const previousCore = parseCoreFunnel(
    ((await previousCoreRes.json()) as CHJson<CoreFunnelRow>).data[0],
  )
  const currentSteps =
    ((await currentStepsRes.json()) as CHJson<StepAggRow>).data ?? []
  const previousSteps =
    ((await previousStepsRes.json()) as CHJson<StepAggRow>).data ?? []
  const dropOffRows =
    ((await dropOffRes.json()) as CHJson<DropOffAggRow>).data ?? []

  const response: FunnelDashboardResponse = {
    rangeId,
    metrics: buildMetrics(currentCore, previousCore, formType),
    multiStepSteps: buildMultiStepSteps(
      currentSteps,
      previousSteps,
      currentCore,
      previousCore,
    ),
    dropOffRows: buildDropOffRows(dropOffRows),
  }

  FUNNEL_RESPONSE_CACHE.set(cacheKey, response)
  return response
}

export { computePeriodChangePct } from '../lib/funnel-trend.js'

const EMPTY_FUNNEL_METRICS: Omit<FunnelMetricRow, 'count' | 'changePct'>[] = [
  { label: 'Landing Page Visits' },
  { label: 'Interactions' },
  { label: 'Form Started' },
  { label: 'Form Submitted' },
]

export function emptyAnalyticsFunnel(rangeId: AnalyticsRangeId): FunnelDashboardResponse {
  return {
    rangeId,
    metrics: EMPTY_FUNNEL_METRICS.map(({ label }) => ({
      label,
      count: 0,
      changePct: null,
    })),
    multiStepSteps: [
      { label: 'Step 1', count: 0, changePct: null },
      { label: 'Step 2', count: 0, changePct: null },
      { label: 'Step 3', count: 0, changePct: null },
      { label: 'Final Submit', count: 0, changePct: null },
    ],
    dropOffRows: [],
  }
}
