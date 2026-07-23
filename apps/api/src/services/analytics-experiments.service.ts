import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getClickHouseClient } from './clickhouse.service.js'
import {
  db,
  experiments,
  landingPages,
  type ExperimentVariantLink,
} from '@workspace/database'
import type {
  AnalyticsExperiments,
  AnalyticsLocationPerformanceRow,
  AnalyticsStatePerformanceRow,
  AnalyticsVariantPerformanceRow,
  AnalyticsZipcodePerformanceRow,
  RangeId,
} from '../types/analytics-experiments.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsWindow,
} from '../lib/analytics-range.js'
import {
  utmFilterParams,
  utmFilterCacheKey,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10

function fsrPct(formSuccessSessions: number, sessions: number): number {
  return sessions > 0 ? round1((formSuccessSessions / sessions) * 100) : 0
}

function normalizeVariantLinks(raw: unknown): ExperimentVariantLink[] {
  if (!Array.isArray(raw)) return []
  const out: ExperimentVariantLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item === 'string') continue
    const record = item as Record<string, unknown>
    const label =
      typeof record.label === 'string' ? record.label.trim() : ''
    const landingPageId =
      typeof record.landingPageId === 'string'
        ? record.landingPageId.trim()
        : ''
    if (!label || !landingPageId) continue
    out.push({ label, landingPageId })
  }
  return out
}

type LocationDimension = 'city' | 'state' | 'zipcode'

type LocationRow = {
  location_label: string
  variant_label: string
  form_submitted: string
  sessions: string
}

function intersectWindowWithExperiment(
  window: AnalyticsWindow,
  experimentStart: Date,
  experimentEnd: Date | null,
): AnalyticsWindow | null {
  const start =
    window.start.getTime() >= experimentStart.getTime()
      ? window.start
      : experimentStart
  const end =
    experimentEnd && experimentEnd.getTime() < window.end.getTime()
      ? experimentEnd
      : window.end
  if (start.getTime() >= end.getTime()) return null
  return {
    ...window,
    start,
    end,
    seriesEnd: end,
  }
}

function multiDomainWhere(utmFilter?: AnalyticsUtmFilter): string {
  return `lp_public_id IN {lp_ids:Array(String)} AND created_at >= toDateTime64({range_from:String}, 3, 'UTC') AND created_at < toDateTime64({range_to:String}, 3, 'UTC')${utmFilterSql(utmFilter)}`
}

function transformLabelExpr(mapEntries: Array<{ publicId: string; label: string }>): string {
  if (mapEntries.length === 0) return `'Unknown'`
  let expr = `'Unknown'`
  for (let i = mapEntries.length - 1; i >= 0; i--) {
    const entry = mapEntries[i]!
    const escapedLabel = entry.label.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const escapedId = entry.publicId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    expr = `if(lp_public_id = '${escapedId}', '${escapedLabel}', ${expr})`
  }
  return expr
}

function zipcodeBreakdownQuery(
  whereSql: string,
  variantExpr: string,
): string {
  return `
    SELECT
      if(session_zip = '', 'Unknown', session_zip) AS location_label,
      if(variant_label = '', 'Unknown', variant_label) AS variant_label,
      countIf(has_form_success = 1) AS form_submitted,
      count() AS sessions
    FROM (
      SELECT
        session_id,
        any(${variantExpr}) AS variant_label,
        max(event_name = 'form_success') AS has_form_success,
        anyIf(
          if(zipcode != '', zipcode, nullIf(JSONExtractString(properties, 'zip'), '')),
          zipcode != '' OR JSONExtractString(properties, 'zip') != ''
        ) AS session_zip
      FROM events_raw
      WHERE ${whereSql}
      GROUP BY session_id
    )
    GROUP BY location_label, variant_label
    ORDER BY sessions DESC
  `
}

function locationBreakdownQuery(
  dimension: LocationDimension,
  whereSql: string,
  variantExpr: string,
): string {
  const labelExpr =
    dimension === 'state'
      ? `if(state != '', state, if(utm_term != '', utm_term, 'Unknown'))`
      : `if(${dimension} = '', 'Unknown', ${dimension})`

  return `
    SELECT
      ${labelExpr} AS location_label,
      ${variantExpr} AS variant_label,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
      uniqExact(session_id) AS sessions
    FROM events_raw
    WHERE ${whereSql}
    GROUP BY location_label, variant_label
    ORDER BY sessions DESC
  `
}

function maxVariantFsr(row: Record<string, string | number>): number {
  let max = 0
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== 'string' || !value.endsWith('%')) continue
    if (!key.startsWith('variant')) continue
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed) && parsed > max) max = parsed
  }
  return max
}

function aggregatePerformanceByDimension<T extends Record<string, string | number>>(
  rows: LocationRow[],
  outputKey: keyof T & string,
): T[] {
  type Accumulator = {
    row: Record<string, string | number>
    conversions: number
    sessions: number
  }

  const map = new Map<string, Accumulator>()
  for (const row of rows) {
    const label = row.location_label
    if (!map.has(label)) {
      map.set(label, {
        row: { [outputKey]: label },
        conversions: 0,
        sessions: 0,
      })
    }
    const entry = map.get(label)!
    const fs = n(row.form_submitted)
    const ses = n(row.sessions)
    entry.row[`variant${row.variant_label}`] = `${fsrPct(fs, ses)}%`
    entry.conversions += fs
    entry.sessions += ses
  }

  return Array.from(map.values())
    .sort(
      (a, b) =>
        maxVariantFsr(b.row) - maxVariantFsr(a.row) ||
        b.conversions - a.conversions ||
        b.sessions - a.sessions,
    )
    .map((entry) => entry.row as T)
}

function computeLift(
  rows: AnalyticsVariantPerformanceRow[],
  controlLabel: string | null,
): AnalyticsVariantPerformanceRow[] {
  if (!controlLabel) {
    return rows.map((row) => ({
      ...row,
      isControl: false,
      visitorsLiftAbs: null,
      visitorsLiftPct: null,
      formSubmittedLiftAbs: null,
      formSubmittedLiftPct: null,
      fsrLiftAbs: null,
      fsrLiftPct: null,
    }))
  }

  const control = rows.find((row) => row.variant === controlLabel)
  return rows.map((row) => {
    const isControl = row.variant === controlLabel
    if (!control || isControl) {
      return {
        ...row,
        isControl,
        visitorsLiftAbs: isControl ? 0 : null,
        visitorsLiftPct: isControl ? 0 : null,
        formSubmittedLiftAbs: isControl ? 0 : null,
        formSubmittedLiftPct: isControl ? 0 : null,
        fsrLiftAbs: isControl ? 0 : null,
        fsrLiftPct: isControl ? 0 : null,
      }
    }

    const visitorsLiftAbs = row.visitors - control.visitors
    const formSubmittedLiftAbs = row.formSubmitted - control.formSubmitted
    const fsrLiftAbs = round1(row.fsr - control.fsr)

    return {
      ...row,
      isControl: false,
      visitorsLiftAbs,
      visitorsLiftPct:
        control.visitors > 0
          ? round1((visitorsLiftAbs / control.visitors) * 100)
          : null,
      formSubmittedLiftAbs,
      formSubmittedLiftPct:
        control.formSubmitted > 0
          ? round1((formSubmittedLiftAbs / control.formSubmitted) * 100)
          : null,
      fsrLiftAbs,
      fsrLiftPct:
        control.fsr > 0 ? round1((fsrLiftAbs / control.fsr) * 100) : null,
    }
  })
}

function ensureLinkedVariantRows(
  rows: AnalyticsVariantPerformanceRow[],
  labels: string[],
): AnalyticsVariantPerformanceRow[] {
  const byLabel = new Map(rows.map((row) => [row.variant, row]))
  return labels.map((label) => {
    const existing = byLabel.get(label)
    if (existing) return existing
    return {
      variant: label,
      visitors: 0,
      formSubmitted: 0,
      fsr: 0,
    }
  })
}

export async function getAnalyticsExperiments({
  workspaceId,
  lpPublicId,
  rangeId,
  utmFilter,
  custom,
}: {
  workspaceId: string
  lpPublicId: string
  rangeId: RangeId
  utmFilter?: AnalyticsUtmFilter
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsExperiments> {
  const now = new Date()
  const baseWindow = resolveAnalyticsWindow(rangeId, now, custom)

  const lp = await db.query.landingPages.findFirst({
    where: eq(landingPages.publicId, lpPublicId),
  })

  let activeExperiments: (typeof experiments.$inferSelect)[] = []
  if (lp) {
    activeExperiments = await db.query.experiments.findMany({
      where: eq(experiments.landingPageId, lp.id),
      orderBy: (exp, { desc }) => [desc(exp.createdAt)],
    })
  }

  const primaryExp = activeExperiments[0] ?? null
  const links = primaryExp
    ? normalizeVariantLinks(primaryExp.variants)
    : []

  let linkedPages: Array<{
    id: string
    publicId: string
    label: string
  }> = []

  if (links.length > 0) {
    const ids = [...new Set(links.map((l) => l.landingPageId))]
    const pages = await db
      .select({
        id: landingPages.id,
        publicId: landingPages.publicId,
      })
      .from(landingPages)
      .where(and(inArray(landingPages.id, ids), isNull(landingPages.deletedAt)))
    const byId = new Map(pages.map((p) => [p.id, p]))
    linkedPages = links
      .map((link) => {
        const page = byId.get(link.landingPageId)
        if (!page) return null
        return { id: page.id, publicId: page.publicId, label: link.label }
      })
      .filter((v): v is NonNullable<typeof v> => v != null)
  }

  const useMultiDomain = linkedPages.length > 0

  let window = baseWindow
  if (primaryExp) {
    const intersected = intersectWindowWithExperiment(
      baseWindow,
      primaryExp.startDate,
      primaryExp.endDate,
    )
    if (!intersected) {
      return {
        experiments: formatExperiments(activeExperiments),
        variantPerformance: computeLift(
          ensureLinkedVariantRows(
            [],
            linkedPages.map((p) => p.label),
          ),
          controlLabelFor(primaryExp, linkedPages),
        ),
        performanceByLocation: [],
        performanceByState: [],
        performanceByZipcode: [],
        controlVariant: controlLabelFor(primaryExp, linkedPages),
        mode: useMultiDomain ? 'multi_domain' : 'data_variant',
      }
    }
    window = intersected
  }

  const utmKey = utmFilterCacheKey(utmFilter)
  const linkKey = useMultiDomain
    ? linkedPages.map((p) => `${p.publicId}:${p.label}`).join(',')
    : 'single'
  const cacheKey = `analytics:experiments:v4-md:${workspaceId}:${lpPublicId}:${rangeCacheKey(window, utmKey)}:${linkKey}:${primaryExp?.id ?? 'none'}`
  const cached = await readAnalyticsCache<AnalyticsExperiments>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const rangeParams = rangeQueryParams(window)
  const utmParams = utmFilterParams(utmFilter)

  let variantPerformance: AnalyticsVariantPerformanceRow[] = []
  let cityRows: LocationRow[] = []
  let stateRows: LocationRow[] = []
  let zipcodeRows: LocationRow[] = []

  if (useMultiDomain) {
    const whereSql = multiDomainWhere(utmFilter)
    const variantExpr = transformLabelExpr(
      linkedPages.map((p) => ({ publicId: p.publicId, label: p.label })),
    )
    const p = {
      lp_ids: linkedPages.map((page) => page.publicId),
      ...rangeParams,
      ...utmParams,
    }

    const [variantRes, cityRes, stateRes, zipcodeRes] = await Promise.all([
      ch.query({
        format: 'JSON',
        query_params: p,
        query: `
          SELECT
            ${variantExpr} AS variant_label,
            uniqExactIf(user_id, event_name = 'page_view') AS visitors,
            uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
            uniqExact(session_id) AS sessions
          FROM events_raw
          WHERE ${whereSql}
          GROUP BY variant_label
          ORDER BY visitors DESC
        `,
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: locationBreakdownQuery('city', whereSql, variantExpr),
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: locationBreakdownQuery('state', whereSql, variantExpr),
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: zipcodeBreakdownQuery(whereSql, variantExpr),
      }),
    ])

    type VariantRow = {
      variant_label: string
      visitors: string
      form_submitted: string
      sessions: string
    }

    const variantRows =
      ((await variantRes.json()) as CHJson<VariantRow>).data ?? []
    cityRows = ((await cityRes.json()) as CHJson<LocationRow>).data ?? []
    stateRows = ((await stateRes.json()) as CHJson<LocationRow>).data ?? []
    zipcodeRows = ((await zipcodeRes.json()) as CHJson<LocationRow>).data ?? []

    variantPerformance = ensureLinkedVariantRows(
      variantRows.map((row) => {
        const visitors = n(row.visitors)
        const fs = n(row.form_submitted)
        const ses = n(row.sessions)
        return {
          variant: row.variant_label,
          visitors,
          formSubmitted: fs,
          fsr: fsrPct(fs, ses),
        }
      }),
      linkedPages.map((page) => page.label),
    )
  } else {
    const where = rangeFilter(utmFilter)
    const p = {
      wid: workspaceId,
      lp: lpPublicId,
      ...rangeParams,
      ...utmParams,
    }

    const singleVariantExpr = `if(variant = '', 'Unknown', variant)`
    const singleWhere = `${where} AND lp_public_id = {lp:String}`

    const [variantRes, cityRes, stateRes, zipcodeRes] = await Promise.all([
      ch.query({
        format: 'JSON',
        query_params: p,
        query: `
          SELECT
            ${singleVariantExpr} AS variant_label,
            uniqExactIf(user_id, event_name = 'page_view') AS visitors,
            uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
            uniqExact(session_id) AS sessions
          FROM events_raw
          WHERE ${singleWhere}
          GROUP BY variant_label
          ORDER BY visitors DESC
        `,
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: locationBreakdownQuery('city', singleWhere, singleVariantExpr),
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: locationBreakdownQuery('state', singleWhere, singleVariantExpr),
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: zipcodeBreakdownQuery(singleWhere, singleVariantExpr),
      }),
    ])

    type VariantRow = {
      variant_label: string
      visitors: string
      form_submitted: string
      sessions: string
    }

    const variantRows =
      ((await variantRes.json()) as CHJson<VariantRow>).data ?? []
    cityRows = ((await cityRes.json()) as CHJson<LocationRow>).data ?? []
    stateRows = ((await stateRes.json()) as CHJson<LocationRow>).data ?? []
    zipcodeRows = ((await zipcodeRes.json()) as CHJson<LocationRow>).data ?? []

    variantPerformance = variantRows.map((row) => {
      const visitors = n(row.visitors)
      const fs = n(row.form_submitted)
      const ses = n(row.sessions)
      return {
        variant: row.variant_label,
        visitors,
        formSubmitted: fs,
        fsr: fsrPct(fs, ses),
      }
    })
  }

  const controlLabel = controlLabelFor(primaryExp, linkedPages)
  const withLift = computeLift(variantPerformance, controlLabel)

  const result: AnalyticsExperiments = {
    experiments: formatExperiments(activeExperiments),
    variantPerformance: withLift,
    performanceByLocation:
      aggregatePerformanceByDimension<AnalyticsLocationPerformanceRow>(
        cityRows,
        'city',
      ),
    performanceByState:
      aggregatePerformanceByDimension<AnalyticsStatePerformanceRow>(
        stateRows,
        'state',
      ),
    performanceByZipcode:
      aggregatePerformanceByDimension<AnalyticsZipcodePerformanceRow>(
        zipcodeRows,
        'zipcode',
      ),
    controlVariant: controlLabel,
    mode: useMultiDomain ? 'multi_domain' : 'data_variant',
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}

function controlLabelFor(
  exp: typeof experiments.$inferSelect | null,
  linkedPages: Array<{ id: string; label: string }>,
): string | null {
  if (!exp?.controlLandingPageId) return null
  return (
    linkedPages.find((p) => p.id === exp.controlLandingPageId)?.label ?? null
  )
}

function formatExperiments(
  activeExperiments: (typeof experiments.$inferSelect)[],
) {
  return activeExperiments.map((exp) => {
    const links = normalizeVariantLinks(exp.variants)
    const labels =
      links.length > 0
        ? links.map((l) => l.label).join(' / ')
        : Array.isArray(exp.variants)
          ? (exp.variants as unknown[])
              .filter((v): v is string => typeof v === 'string')
              .join(' / ')
          : ''
    return {
      id: exp.id,
      name: exp.name,
      status: exp.status,
      variants: labels,
      startDate: exp.startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      endDate: exp.endDate
        ? exp.endDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : null,
      noEndDate: exp.endDate == null,
      highlighted: exp.highlighted === 'true',
    }
  })
}

export function emptyAnalyticsExperiments(): AnalyticsExperiments {
  return {
    experiments: [],
    variantPerformance: [],
    performanceByLocation: [],
    performanceByState: [],
    performanceByZipcode: [],
    controlVariant: null,
    mode: 'data_variant',
  }
}
