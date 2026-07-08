import {
  previousRangeFilter,
  rangeFilter,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import { computePeriodChangePct } from '../lib/funnel-trend.js'
import { redis } from './redis.service.js'
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
const STEP_NAME_EXPR = `nullIf(JSONExtractString(properties, 'stepName'), '')`

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
    FROM events_raw
    WHERE ${whereClause}
  `
}

type StepAggRow = {
  step_index: string
  step_name?: string
  sessions: string
}

function multiStepQuery(whereClause: string): string {
  return `
    SELECT
      step_index,
      anyHeavy(step_name) AS step_name,
      uniqExact(session_id) AS sessions
    FROM (
      SELECT
        session_id,
        ${STEP_INDEX_EXPR} AS step_index,
        ${STEP_NAME_EXPR} AS step_name
      FROM events_raw
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
      uniqExact(session_id) AS reached,
      uniqExactIf(session_id, isNull(success_session_id)) AS drop_offs
    FROM (
      SELECT
        fo.session_id AS session_id,
        fo.field_name AS field_name,
        su.session_id AS success_session_id
      FROM (
        SELECT DISTINCT
          session_id,
          ${FIELD_NAME_EXPR} AS field_name
        FROM events_raw
        WHERE ${whereClause}
          AND event_name = 'form_field_focus'
          AND ${FIELD_NAME_EXPR} != ''
      ) AS fo
      LEFT JOIN (
        SELECT session_id
        FROM events_raw
        WHERE ${whereClause}
          AND event_name = 'form_success'
        GROUP BY session_id
      ) AS su ON fo.session_id = su.session_id
    )
    GROUP BY field_name
    HAVING drop_offs > 0
    ORDER BY drop_offs DESC, reached DESC
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

  const submittedCur = isZip
    ? current.zipSubmitted || current.formSubmitted
    : current.formSubmitted
  const submittedPrev = isZip
    ? previous.zipSubmitted || previous.formSubmitted
    : previous.formSubmitted

  const startedCur = isZip
    ? Math.max(current.zipStarted, current.formStarted, submittedCur)
    : current.formStarted
  const startedPrev = isZip
    ? Math.max(previous.zipStarted, previous.formStarted, submittedPrev)
    : previous.formStarted

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

function resolveStepLabel(
  stepIndex: number,
  currentSteps: StepAggRow[],
  previousSteps: StepAggRow[],
): string {
  const fromCurrent = currentSteps
    .find((row) => n(row.step_index) === stepIndex)
    ?.step_name?.trim()
  if (fromCurrent) return fromCurrent

  const fromPrevious = previousSteps
    .find((row) => n(row.step_index) === stepIndex)
    ?.step_name?.trim()
  if (fromPrevious) return fromPrevious

  return `Step ${stepIndex}`
}

function buildMultiStepSteps(
  currentSteps: StepAggRow[],
  previousSteps: StepAggRow[],
  currentCore: ReturnType<typeof parseCoreFunnel>,
  previousCore: ReturnType<typeof parseCoreFunnel>,
): FunnelMultiStepRow[] {
  const curMap = new Map(
    currentSteps.map((row) => [n(row.step_index), n(row.sessions)]),
  )
  const prevMap = new Map(
    previousSteps.map((row) => [n(row.step_index), n(row.sessions)]),
  )

  const stepIndices = [
    ...new Set([
      ...currentSteps.map((row) => n(row.step_index)),
      ...previousSteps.map((row) => n(row.step_index)),
    ]),
  ]
    .filter((index) => index > 0)
    .sort((a, b) => a - b)

  const steps: FunnelMultiStepRow[] = stepIndices.map((index) => ({
    label: resolveStepLabel(index, currentSteps, previousSteps),
    count: curMap.get(index) ?? 0,
    changePct: computePeriodChangePct(
      curMap.get(index) ?? 0,
      prevMap.get(index) ?? 0,
    ),
  }))

  if (
    stepIndices.length > 0 ||
    currentCore.formSubmitted > 0 ||
    previousCore.formSubmitted > 0
  ) {
    steps.push({
      label: 'Form Submitted',
      count: currentCore.formSubmitted,
      changePct: computePeriodChangePct(
        currentCore.formSubmitted,
        previousCore.formSubmitted,
      ),
    })
  }

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

export async function getAnalyticsFunnel({
  workspaceId,
  rangeId,
  formType = 'single',
}: GetAnalyticsFunnelParams): Promise<FunnelDashboardResponse> {
  const cacheKey = `analytics:funnel:v4:${workspaceId}:${rangeId}:${formType}`
  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as FunnelDashboardResponse
    }
  } catch (err) {
    // ignore cache read errors
  }

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

  try {
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 45)
  } catch (err) {
    // ignore cache write errors
  }
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
    multiStepSteps: [],
    dropOffRows: [],
  }
}
