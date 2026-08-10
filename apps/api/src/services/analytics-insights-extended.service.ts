import {
  chDayBucketKey,
  chWeekBucketKey,
} from '../lib/analytics-timezone.js'
import type {
  AnalyticsInsights,
  InsightChart,
  InsightSectionId,
} from '../types/analytics-insights.js'
import { emptyAnalyticsInsights } from '../types/analytics-insights.js'
import {
  AGE_BAND_EXPR,
  AGE_BANDS,
  AGE_EXPR,
  FIELD,
  LEAD_EVENT,
  TF_EXPR,
  TOP_N,
  ZIP_SUBMIT,
  kpi,
  n,
  pct,
  pivotSeries,
  queryJson,
  round1,
  type InsightsQueryCtx,
} from './analytics-insights.service.js'

type Ctx = InsightsQueryCtx

async function dropoffInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const FIELD_NAME = `nullIf(JSONExtractString(properties, 'fieldName'), '')`
  const STEP_NAME = `if(nullIf(JSONExtractString(properties, 'stepName'), '') = '', concat('Step ', toString(JSONExtractUInt(properties, 'stepIndex'))), JSONExtractString(properties, 'stepName'))`

  const [byField, dobFields, byStage, byDevice, byState] = await Promise.all([
    queryJson<{ day: string; field: string; focuses: string }>(
      `
      SELECT
        ${dayKey} AS day,
        ${FIELD_NAME} AS field,
        uniqExact(session_id) AS focuses
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_field_focus'
        AND ${FIELD_NAME} != ''
      GROUP BY day, field
      ORDER BY day ASC
      LIMIT 2000
      `,
      ctx.p,
    ),
    queryJson<{ day: string; field: string; focuses: string }>(
      `
      SELECT
        ${dayKey} AS day,
        ${FIELD_NAME} AS field,
        uniqExact(session_id) AS focuses
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_field_focus'
        AND (
          positionCaseInsensitive(${FIELD_NAME}, 'dob') > 0
          OR positionCaseInsensitive(${FIELD_NAME}, 'month') > 0
          OR positionCaseInsensitive(${FIELD_NAME}, 'day') > 0
          OR positionCaseInsensitive(${FIELD_NAME}, 'year') > 0
        )
      GROUP BY day, field
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; stage: string; sessions: string }>(
      `
      SELECT
        ${dayKey} AS day,
        ${STEP_NAME} AS stage,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_step_view'
      GROUP BY day, stage
      ORDER BY day ASC
      LIMIT 2000
      `,
      ctx.p,
    ),
    queryJson<{ day: string; device: string; focuses: string; sessions: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
        uniqExactIf(session_id, event_name = 'form_field_focus') AS focuses,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, device
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; state: string; focuses: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(state = '', 'Unknown', state) AS state,
        uniqExactIf(session_id, event_name = 'form_field_focus') AS focuses
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, state
      ORDER BY focuses DESC
      LIMIT 800
      `,
      ctx.p,
    ),
  ])

  const topFields = [
    ...new Set(
      byField
        .map((r) => ({ f: r.field, v: n(r.focuses) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.f),
    ),
  ].slice(0, TOP_N)

  const fieldPivot = pivotSeries(
    byField
      .filter((r) => topFields.includes(r.field))
      .map((r) => ({
        bucket: r.day,
        series: r.field,
        value: n(r.focuses),
      })),
    topFields,
  )

  const dobKeys = [
    ...new Set(dobFields.map((r) => r.field)),
  ].slice(0, 3)
  const dobPivot = pivotSeries(
    dobFields
      .filter((r) => dobKeys.includes(r.field))
      .map((r) => ({
        bucket: r.day,
        series: r.field,
        value: n(r.focuses),
      })),
    dobKeys.length > 0 ? dobKeys : ['dob'],
  )

  const topStages = [
    ...new Set(
      byStage
        .map((r) => ({ s: r.stage, v: n(r.sessions) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, 5)

  const stagePivot = pivotSeries(
    byStage
      .filter((r) => topStages.includes(r.stage))
      .map((r) => ({
        bucket: r.day,
        series: r.stage,
        value: n(r.sessions),
      })),
    topStages,
  )

  const devicePivot = pivotSeries(
    byDevice.map((r) => ({
      bucket: r.day,
      series: r.device,
      value: pct(n(r.focuses), n(r.sessions)),
    })),
    ['desktop', 'mobile', 'tablet'],
  )

  const topStates = [
    ...new Set(
      byState
        .map((r) => ({ s: r.state, v: n(r.focuses) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, TOP_N)

  const statePivot = pivotSeries(
    byState
      .filter((r) => topStates.includes(r.state))
      .map((r) => ({
        bucket: r.day,
        series: r.state,
        value: n(r.focuses),
      })),
    topStates,
  )

  // Age band × stage heatmap (latest aggregate)
  const ageStage = await queryJson<{ band: string; stage: string; sessions: string }>(
    `
    SELECT
      band,
      stage,
      uniqExact(session_id) AS sessions
    FROM (
      SELECT
        session_id,
        ${STEP_NAME} AS stage,
        any(${AGE_BAND_EXPR}) AS band
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_step_view'
      GROUP BY session_id, stage
    )
    GROUP BY band, stage
    LIMIT 200
    `,
    ctx.p,
  )

  return {
    section: 'dropoff',
    kpis: [
      kpi('top_field', 'Top field focuses', n(byField[0]?.focuses)),
      kpi('fields', 'Tracked fields', topFields.length),
      kpi('stages', 'Stages', topStages.length),
    ],
    charts: [
      {
        id: 'dropoff-fields',
        title: 'Drop-offs per field over time',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: fieldPivot.seriesKeys,
        points: fieldPivot.points,
      },
      {
        id: 'dob-dropoff',
        title: 'DOB month/day/year drop-off',
        type: 'multi-line',
        seriesKeys: dobPivot.seriesKeys,
        points: dobPivot.points,
      },
      {
        id: 'stage-abandon',
        title: 'Stage-level abandonment',
        type: 'stacked-bar',
        fullWidth: true,
        seriesKeys: stagePivot.seriesKeys,
        points: stagePivot.points,
      },
      {
        id: 'dropoff-device',
        title: 'Drop-off rate by device',
        type: 'multi-line',
        seriesKeys: devicePivot.seriesKeys,
        points: devicePivot.points,
      },
      {
        id: 'dropoff-age-stage',
        title: 'Drop-off stage by age band',
        type: 'heatmap',
        fullWidth: true,
        rowKeys: [...AGE_BANDS],
        colKeys: topStages,
        points: ageStage.map((r) => ({
          row: r.band,
          col: r.stage,
          value: n(r.sessions),
        })),
      },
      {
        id: 'dropoff-state',
        title: 'Drop-off by state over time',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: statePivot.seriesKeys,
        points: statePivot.points,
      },
    ],
  }
}

async function deviceInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const [byDeviceDay, vitals, ageDevice, stageDevice] = await Promise.all([
    queryJson<{
      day: string
      device: string
      visitors: string
      sessions: string
      zips: string
      leads: string
    }>(
      `
      SELECT
        ${dayKey} AS day,
        if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, device
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{
      day: string
      device: string
      lcp: string
      fcp: string
      inp: string
    }>(
      `
      SELECT
        ${dayKey} AS day,
        if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
        quantileExactIf(0.75)(metric_value, metric_name = 'LCP') AS lcp,
        quantileExactIf(0.75)(metric_value, metric_name = 'FCP') AS fcp,
        quantileExactIf(0.75)(metric_value, metric_name = 'INP') AS inp
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'web_vitals'
        AND metric_name IN ('LCP', 'FCP', 'INP')
      GROUP BY day, device
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; device: string; band: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
        ${AGE_BAND_EXPR} AS band,
        count() AS leads
      FROM events_raw
      WHERE ${ctx.where}
        AND ${LEAD_EVENT}
      GROUP BY day, device, band
      LIMIT 1500
      `,
      ctx.p,
    ),
    queryJson<{ device: string; stage: string; sessions: string }>(
      `
      SELECT
        if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
        if(nullIf(JSONExtractString(properties, 'stepName'), '') = '', concat('Step ', toString(JSONExtractUInt(properties, 'stepIndex'))), JSONExtractString(properties, 'stepName')) AS stage,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_step_view'
      GROUP BY device, stage
      ORDER BY sessions DESC
      LIMIT 100
      `,
      ctx.p,
    ),
  ])

  const devices = ['desktop', 'mobile', 'tablet']
  const sharePivot = pivotSeries(
    byDeviceDay.map((r) => ({
      bucket: r.day,
      series: r.device,
      value: n(r.visitors),
    })),
    devices,
  )
  const zsrPivot = pivotSeries(
    byDeviceDay.map((r) => ({
      bucket: r.day,
      series: r.device,
      value: pct(n(r.zips), n(r.sessions)),
    })),
    devices,
  )
  const leadPivot = pivotSeries(
    byDeviceDay.map((r) => ({
      bucket: r.day,
      series: r.device,
      value: pct(n(r.leads), n(r.sessions)),
    })),
    devices,
  )

  const ageDevicePivot = pivotSeries(
    ageDevice.map((r) => ({
      bucket: `${r.day}|${r.device}`,
      series: r.band,
      value: n(r.leads),
    })),
    [...AGE_BANDS],
  )

  const ageByDeviceTotals = await queryJson<{
    device: string
    band: string
    leads: string
  }>(
    `
    SELECT
      if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
      ${AGE_BAND_EXPR} AS band,
      count() AS leads
    FROM events_raw
    WHERE ${ctx.where}
      AND ${LEAD_EVENT}
    GROUP BY device, band
    `,
    ctx.p,
  )

  const ageDeviceBars = pivotSeries(
    ageByDeviceTotals.map((r) => ({
      bucket: r.device,
      series: r.band,
      value: n(r.leads),
    })),
    [...AGE_BANDS],
  )

  const topStages = [
    ...new Set(
      stageDevice
        .map((r) => ({ s: r.stage, v: n(r.sessions) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, 5)

  const stageBars = pivotSeries(
    stageDevice
      .filter((r) => topStages.includes(r.stage))
      .map((r) => ({
        bucket: r.device,
        series: r.stage,
        value: n(r.sessions),
      })),
    topStages,
  )

  const lcpPoints = vitals.map((r) => ({
    label: r.day,
    device: r.device,
    value: round1(n(r.lcp)),
  }))
  const lcpPivot = pivotSeries(
    lcpPoints.map((r) => ({
      bucket: String(r.label),
      series: String(r.device),
      value: Number(r.value),
    })),
    devices,
  )
  const fcpPivot = pivotSeries(
    vitals.map((r) => ({
      bucket: r.day,
      series: r.device,
      value: round1(n(r.fcp)),
    })),
    devices,
  )
  const inpPivot = pivotSeries(
    vitals.map((r) => ({
      bucket: r.day,
      series: r.device,
      value: round1(n(r.inp)),
    })),
    devices,
  )

  void ageDevicePivot

  const totals = devices.map((d) => ({
    device: d,
    visitors: byDeviceDay
      .filter((r) => r.device === d)
      .reduce((s, r) => s + n(r.visitors), 0),
  }))
  const topDev = [...totals].sort((a, b) => b.visitors - a.visitors)[0]

  return {
    section: 'device',
    kpis: [
      kpi('top_device_visitors', `${topDev?.device ?? 'desktop'} visitors`, topDev?.visitors ?? 0),
      kpi('devices', 'Devices', devices.length),
    ],
    charts: [
      {
        id: 'visitor-share-device',
        title: 'Visitor share by device',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: sharePivot.seriesKeys,
        points: sharePivot.points,
      },
      {
        id: 'zsr-device',
        title: 'ZSR by device',
        type: 'multi-line',
        seriesKeys: zsrPivot.seriesKeys,
        points: zsrPivot.points,
      },
      {
        id: 'lead-device',
        title: 'Lead rate by device',
        type: 'multi-line',
        seriesKeys: leadPivot.seriesKeys,
        points: leadPivot.points,
      },
      {
        id: 'age-device',
        title: 'Age band by device',
        type: 'stacked-bar',
        seriesKeys: ageDeviceBars.seriesKeys,
        points: ageDeviceBars.points,
      },
      {
        id: 'stage-device',
        title: 'Drop-off stage by device',
        type: 'stacked-bar',
        seriesKeys: stageBars.seriesKeys,
        points: stageBars.points,
      },
      {
        id: 'lcp-device',
        title: 'LCP p75 by device',
        type: 'multi-line',
        seriesKeys: lcpPivot.seriesKeys,
        points: lcpPivot.points,
      },
      {
        id: 'fcp-device',
        title: 'FCP p75 by device',
        type: 'multi-line',
        seriesKeys: fcpPivot.seriesKeys,
        points: fcpPivot.points,
      },
      {
        id: 'inp-device',
        title: 'INP p75 by device',
        type: 'multi-line',
        seriesKeys: inpPivot.seriesKeys,
        points: inpPivot.points,
      },
    ],
  }
}

async function geoInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const weekKey = chWeekBucketKey('created_at')

  const [byState, byCity, byZipWeek, rates, vitalsState] = await Promise.all([
    queryJson<{ day: string; state: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(state = '', 'Unknown', state) AS state,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, state
      ORDER BY day ASC
      LIMIT 2000
      `,
      ctx.p,
    ),
    queryJson<{ day: string; city: string; sessions: string; zips: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(city = '', 'Unknown', city) AS city,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, city
      ORDER BY day ASC
      LIMIT 3000
      `,
      ctx.p,
    ),
    queryJson<{ week: string; zip: string; volume: string }>(
      `
      SELECT
        ${weekKey} AS week,
        if(zipcode = '', 'Unknown', zipcode) AS zip,
        count() AS volume
      FROM events_raw
      WHERE ${ctx.where}
        AND zipcode != ''
      GROUP BY week, zip
      ORDER BY week ASC, volume DESC
      LIMIT 2000
      `,
      ctx.p,
    ),
    queryJson<{
      state: string
      leads: string
      insured: string
      dui: string
      multi: string
    }>(
      `
      SELECT
        if(state = '', 'Unknown', state) AS state,
        countIf(${LEAD_EVENT}) AS leads,
        countIf(${LEAD_EVENT} AND lower(${FIELD('currently_insured')}) IN ('yes','true','y')) AS insured,
        countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_dui')}) IN ('yes','true','y')) AS dui,
        countIf(${LEAD_EVENT} AND (
          ${FIELD('car_1_year')} != '' OR ${FIELD('car_1_make')} != ''
          OR lower(${FIELD('second_vehicle')}) IN ('yes','true','y')
        )) AS multi
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY state
      ORDER BY leads DESC
      LIMIT 60
      `,
      ctx.p,
    ),
    queryJson<{ day: string; state: string; lcp: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(state = '', 'Unknown', state) AS state,
        quantileExactIf(0.75)(metric_value, metric_name = 'LCP') AS lcp
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'web_vitals'
        AND metric_name = 'LCP'
      GROUP BY day, state
      ORDER BY day ASC
      LIMIT 1500
      `,
      ctx.p,
    ),
  ])

  const topStates = [
    ...new Set(
      byState
        .map((r) => ({ s: r.state, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, TOP_N)

  const statePivot = pivotSeries(
    byState
      .filter((r) => topStates.includes(r.state))
      .map((r) => ({ bucket: r.day, series: r.state, value: n(r.leads) })),
    topStates,
  )

  const topCities = [
    ...new Set(
      byCity
        .map((r) => ({ c: r.city, v: n(r.leads) + n(r.zips) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.c),
    ),
  ].slice(0, TOP_N)

  const cityZsr = pivotSeries(
    byCity
      .filter((r) => topCities.includes(r.city))
      .map((r) => ({
        bucket: r.day,
        series: r.city,
        value: pct(n(r.zips), n(r.sessions)),
      })),
    topCities,
  )
  const cityLead = pivotSeries(
    byCity
      .filter((r) => topCities.includes(r.city))
      .map((r) => ({
        bucket: r.day,
        series: r.city,
        value: pct(n(r.leads), n(r.sessions)),
      })),
    topCities,
  )

  // ZIP rank shift: compare first vs last week ranks
  const weeks = [...new Set(byZipWeek.map((r) => r.week))].sort()
  const firstWeek = weeks[0]
  const lastWeek = weeks[weeks.length - 1]
  const rank = (week: string | undefined) => {
    const rows = byZipWeek
      .filter((r) => r.week === week)
      .sort((a, b) => n(b.volume) - n(a.volume))
      .slice(0, 15)
    return new Map(rows.map((r, i) => [r.zip, { rank: i + 1, volume: n(r.volume) }]))
  }
  const first = rank(firstWeek)
  const last = rank(lastWeek)
  const zipTable = [...new Set([...first.keys(), ...last.keys()])]
    .map((zip) => {
      const a = first.get(zip)
      const b = last.get(zip)
      return {
        zip,
        prevRank: a?.rank ?? '—',
        currRank: b?.rank ?? '—',
        delta:
          a && b ? a.rank - b.rank : a ? -a.rank : b ? b.rank : 0,
        volume: b?.volume ?? a?.volume ?? 0,
      }
    })
    .sort((a, b) => Number(a.currRank === '—' ? 99 : a.currRank) - Number(b.currRank === '—' ? 99 : b.currRank))
    .slice(0, 15)

  const vitalsPivot = pivotSeries(
    vitalsState
      .filter((r) => topStates.includes(r.state))
      .map((r) => ({
        bucket: r.day,
        series: r.state,
        value: round1(n(r.lcp)),
      })),
    topStates,
  )

  const ageState =
    topStates.length === 0
      ? []
      : await queryJson<{ state: string; band: string; leads: string }>(
          `
    SELECT
      if(state = '', 'Unknown', state) AS state,
      ${AGE_BAND_EXPR} AS band,
      count() AS leads
    FROM events_raw
    WHERE ${ctx.where}
      AND ${LEAD_EVENT}
      AND state IN ({states:Array(String)})
    GROUP BY state, band
    `,
          { ...ctx.p, states: topStates },
        )

  return {
    section: 'geo',
    kpis: [
      kpi('top_state_leads', 'Top state leads', n(
        byState.filter((r) => r.state === topStates[0]).reduce((s, r) => s + n(r.leads), 0),
      )),
      kpi('states', 'Active states', topStates.length),
      kpi('cities', 'Tracked cities', topCities.length),
    ],
    charts: [
      {
        id: 'leads-by-state',
        title: 'Leads by state over time',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: statePivot.seriesKeys,
        points: statePivot.points,
      },
      {
        id: 'zsr-by-city',
        title: 'ZSR by city',
        type: 'multi-line',
        seriesKeys: cityZsr.seriesKeys,
        points: cityZsr.points,
      },
      {
        id: 'lead-by-city',
        title: 'Lead rate by city',
        type: 'multi-line',
        seriesKeys: cityLead.seriesKeys,
        points: cityLead.points,
      },
      {
        id: 'zip-shift',
        title: 'Top ZIP volume shift (weekly)',
        type: 'table',
        fullWidth: true,
        columns: [
          { key: 'zip', label: 'ZIP' },
          { key: 'prevRank', label: 'Prev rank' },
          { key: 'currRank', label: 'Curr rank' },
          { key: 'delta', label: 'Delta' },
          { key: 'volume', label: 'Volume' },
        ],
        points: zipTable,
      },
      {
        id: 'profile-rates-map',
        title: 'Profile rates by state',
        helper: 'Insured, DUI, and multi-vehicle rates on the map',
        type: 'us-map',
        fullWidth: true,
        seriesKeys: ['Insured', 'DUI', 'Multi-vehicle'],
        points: rates.map((r) => ({
          state: r.state,
          Insured: pct(n(r.insured), n(r.leads)),
          DUI: pct(n(r.dui), n(r.leads)),
          'Multi-vehicle': pct(n(r.multi), n(r.leads)),
          leads: n(r.leads),
        })),
      },
      {
        id: 'age-by-state',
        title: 'Age band by state',
        type: 'stacked-bar',
        fullWidth: true,
        seriesKeys: [...AGE_BANDS],
        points: pivotSeries(
          ageState.map((r) => ({
            bucket: r.state,
            series: r.band,
            value: n(r.leads),
          })),
          [...AGE_BANDS],
        ).points,
      },
      {
        id: 'vitals-by-state',
        title: 'LCP p75 by state over time',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: vitalsPivot.seriesKeys,
        points: vitalsPivot.points,
      },
    ],
  }
}

async function experimentInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const weekKey = chWeekBucketKey('created_at')

  const [byVariant, retention, returnLead] = await Promise.all([
    queryJson<{
      day: string
      variant: string
      sessions: string
      zips: string
      leads: string
    }>(
      `
      SELECT
        ${dayKey} AS day,
        if(variant = '', '(none)', variant) AS variant,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, variant
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ week: string; week_number: string; users: string }>(
      `
      SELECT
        formatDateTime(cohort_week, '%Y-%m-%d') AS week,
        toString(week_number) AS week_number,
        users
      FROM (
        SELECT
          cohort_week,
          dateDiff('week', cohort_week, activity_week) AS week_number,
          uniqExact(vid) AS users
        FROM (
          SELECT
            coalesce(nullIf(user_id, ''), nullIf(fingerprint, ''), session_id) AS vid,
            toStartOfWeek(min(created_at), 1) AS cohort_week
          FROM events_raw
          WHERE ${ctx.where}
          GROUP BY vid
        ) AS c
        INNER JOIN (
          SELECT
            coalesce(nullIf(user_id, ''), nullIf(fingerprint, ''), session_id) AS vid,
            toStartOfWeek(created_at, 1) AS activity_week
          FROM events_raw
          WHERE workspace_id = {wid:UUID}
          GROUP BY vid, activity_week
        ) AS a ON a.vid = c.vid
        WHERE dateDiff('week', cohort_week, activity_week) BETWEEN 0 AND 8
        GROUP BY cohort_week, week_number
      )
      ORDER BY week DESC, week_number ASC
      LIMIT 200
      `,
      ctx.p,
    ),
    queryJson<{ day: string; rate: string }>(
      `
      SELECT
        day,
        if(returning_sessions > 0, round(returning_leads * 100.0 / returning_sessions, 1), 0) AS rate
      FROM (
        SELECT
          ${dayKey} AS day,
          uniqExactIf(session_id, is_return = 1) AS returning_sessions,
          uniqExactIf(session_id, is_return = 1 AND has_lead = 1) AS returning_leads
        FROM (
          SELECT
            session_id,
            created_at,
            max(${LEAD_EVENT}) OVER (PARTITION BY session_id) AS has_lead,
            if(
              min(created_at) OVER (
                PARTITION BY coalesce(nullIf(user_id, ''), fingerprint, session_id)
              ) < created_at - INTERVAL 1 DAY,
              1,
              0
            ) AS is_return
          FROM events_raw
          WHERE ${ctx.where}
        )
        GROUP BY day
      )
      ORDER BY day ASC
      `,
      ctx.p,
    ),
  ])

  const topVariants = [
    ...new Set(
      byVariant
        .map((r) => ({ v: r.variant, s: n(r.sessions) }))
        .sort((a, b) => b.s - a.s)
        .map((r) => r.v),
    ),
  ]
    .filter((v) => v !== '(none)')
    .slice(0, TOP_N)

  const variantKeys = topVariants.length > 0 ? topVariants : ['(none)']

  const trafficPivot = pivotSeries(
    byVariant
      .filter((r) => variantKeys.includes(r.variant))
      .map((r) => ({
        bucket: r.day,
        series: r.variant,
        value: n(r.sessions),
      })),
    variantKeys,
  )
  const zsrPivot = pivotSeries(
    byVariant
      .filter((r) => variantKeys.includes(r.variant))
      .map((r) => ({
        bucket: r.day,
        series: r.variant,
        value: pct(n(r.zips), n(r.sessions)),
      })),
    variantKeys,
  )
  const leadPivot = pivotSeries(
    byVariant
      .filter((r) => variantKeys.includes(r.variant))
      .map((r) => ({
        bucket: r.day,
        series: r.variant,
        value: pct(n(r.leads), n(r.sessions)),
      })),
    variantKeys,
  )

  const cohortWeeks = [...new Set(retention.map((r) => r.week))].slice(0, 6)
  const retentionPivot = pivotSeries(
    retention
      .filter((r) => cohortWeeks.includes(r.week))
      .map((r) => ({
        bucket: `W${r.week_number}`,
        series: r.week,
        value: n(r.users),
      })),
    cohortWeeks,
  )

  void weekKey

  return {
    section: 'experiment',
    kpis: [
      kpi('variants', 'Variants', variantKeys.length),
      kpi('cohorts', 'Cohort weeks', cohortWeeks.length),
    ],
    charts: [
      {
        id: 'variant-split',
        title: 'Variant traffic split',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: trafficPivot.seriesKeys,
        points: trafficPivot.points,
      },
      {
        id: 'zsr-variant',
        title: 'ZSR by variant',
        type: 'multi-line',
        seriesKeys: zsrPivot.seriesKeys,
        points: zsrPivot.points,
      },
      {
        id: 'lead-variant',
        title: 'Lead rate by variant',
        type: 'multi-line',
        seriesKeys: leadPivot.seriesKeys,
        points: leadPivot.points,
      },
      {
        id: 'cohort-retention',
        title: 'Weekly cohort retention',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: retentionPivot.seriesKeys,
        points: retentionPivot.points,
      },
      {
        id: 'return-lead-rate',
        title: 'Return-visitor lead rate',
        type: 'line',
        seriesKeys: ['value'],
        points: returnLead.map((r) => ({ label: r.day, value: n(r.rate) })),
      },
    ],
  }
}

async function ageInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const weekKey = chWeekBucketKey('created_at')

  const [dist, bySource, byDevice, byState, dobHist, vsStage, rates] =
    await Promise.all([
      queryJson<{ day: string; band: string; leads: string }>(
        `
        SELECT ${dayKey} AS day, ${AGE_BAND_EXPR} AS band, count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day, band ORDER BY day ASC
        `,
        ctx.p,
      ),
      queryJson<{ day: string; source: string; band: string; leads: string }>(
        `
        SELECT
          ${dayKey} AS day,
          if(utm_source = '', '(direct)', utm_source) AS source,
          ${AGE_BAND_EXPR} AS band,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day, source, band
        LIMIT 2000
        `,
        ctx.p,
      ),
      queryJson<{ day: string; device: string; band: string; leads: string }>(
        `
        SELECT
          ${dayKey} AS day,
          if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
          ${AGE_BAND_EXPR} AS band,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day, device, band
        LIMIT 1500
        `,
        ctx.p,
      ),
      queryJson<{ state: string; band: string; leads: string }>(
        `
        SELECT
          if(state = '', 'Unknown', state) AS state,
          ${AGE_BAND_EXPR} AS band,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY state, band
        ORDER BY leads DESC
        LIMIT 200
        `,
        ctx.p,
      ),
      queryJson<{ week: string; birth_year: string; leads: string }>(
        `
        SELECT
          ${weekKey} AS week,
          toString(
            multiIf(
              match(${FIELD('dob')}, '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'),
                toInt32OrZero(substring(${FIELD('dob')}, 7, 4)),
              match(${FIELD('dob-0-year')}, '^[0-9]{4}$'),
                toInt32OrZero(${FIELD('dob-0-year')}),
              0
            )
          ) AS birth_year,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY week, birth_year
        HAVING birth_year != '0'
        ORDER BY week ASC
        LIMIT 1500
        `,
        ctx.p,
      ),
      queryJson<{ band: string; stage: string; sessions: string }>(
        `
        SELECT band, stage, uniqExact(session_id) AS sessions
        FROM (
          SELECT
            session_id,
            if(nullIf(JSONExtractString(properties, 'stepName'), '') = '', concat('Step ', toString(JSONExtractUInt(properties, 'stepIndex'))), JSONExtractString(properties, 'stepName')) AS stage,
            any(${AGE_BAND_EXPR}) AS band
          FROM events_raw
          WHERE ${ctx.where} AND event_name = 'form_step_view'
          GROUP BY session_id, stage
        )
        GROUP BY band, stage
        LIMIT 200
        `,
        ctx.p,
      ),
      queryJson<{
        band: string
        leads: string
        completed: string
        multi: string
        insured: string
      }>(
        `
        SELECT
          ${AGE_BAND_EXPR} AS band,
          count() AS leads,
          count() AS completed,
          countIf(
            ${FIELD('car_1_year')} != '' OR ${FIELD('car_1_make')} != ''
            OR lower(${FIELD('second_vehicle')}) IN ('yes','true','y')
          ) AS multi,
          countIf(lower(${FIELD('currently_insured')}) IN ('yes','true','y')) AS insured
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY band
        `,
        ctx.p,
      ),
    ])

  const seniorWeekly = await queryJson<{ week: string; senior: string; total: string }>(
    `
    SELECT
      ${weekKey} AS week,
      countIf(${AGE_BAND_EXPR} = '65+') AS senior,
      count() AS total
    FROM events_raw
    WHERE ${ctx.where} AND ${LEAD_EVENT}
    GROUP BY week
    ORDER BY week ASC
    `,
    ctx.p,
  )

  const distPivot = pivotSeries(
    dist.map((r) => ({ bucket: r.day, series: r.band, value: n(r.leads) })),
    [...AGE_BANDS],
  )

  const topSources = [
    ...new Set(
      bySource
        .map((r) => ({ s: r.source, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, 4)

  const ageSourceBars = pivotSeries(
    bySource
      .filter((r) => topSources.includes(r.source))
      .map((r) => ({
        bucket: r.source,
        series: r.band,
        value: n(r.leads),
      })),
    [...AGE_BANDS],
  )

  const ageDeviceBars = pivotSeries(
    byDevice.map((r) => ({
      bucket: r.device,
      series: r.band,
      value: n(r.leads),
    })),
    [...AGE_BANDS],
  )

  const topStates = [
    ...new Set(
      byState
        .map((r) => ({ s: r.state, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, 8)

  const ageStateBars = pivotSeries(
    byState
      .filter((r) => topStates.includes(r.state))
      .map((r) => ({
        bucket: r.state,
        series: r.band,
        value: n(r.leads),
      })),
    [...AGE_BANDS],
  )

  const birthYears = [
    ...new Set(
      dobHist
        .map((r) => r.birth_year)
        .filter((y) => Number(y) > 1930 && Number(y) < 2015),
    ),
  ]
    .sort()
    .slice(-20)

  const dobPoints = dobHist
    .filter((r) => birthYears.includes(r.birth_year))
    .map((r) => ({
      row: r.week,
      col: r.birth_year,
      value: n(r.leads),
    }))

  const topStages = [
    ...new Set(
      vsStage
        .map((r) => ({ s: r.stage, v: n(r.sessions) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, 6)

  const seniorShare = seniorWeekly.reduce((s, r) => s + n(r.senior), 0)
  const seniorTotal = seniorWeekly.reduce((s, r) => s + n(r.total), 0)

  void AGE_EXPR

  return {
    section: 'age',
    kpis: [
      kpi('senior_share', 'Senior 65+ %', pct(seniorShare, seniorTotal), 'percent'),
      kpi('bands', 'Age bands', AGE_BANDS.length),
    ],
    charts: [
      {
        id: 'age-dist',
        title: 'Age band distribution over time',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: distPivot.seriesKeys,
        points: distPivot.points,
      },
      {
        id: 'age-by-source',
        title: 'Age band by source',
        type: 'stacked-bar',
        seriesKeys: ageSourceBars.seriesKeys,
        points: ageSourceBars.points,
      },
      {
        id: 'age-by-device',
        title: 'Age band by device',
        type: 'stacked-bar',
        seriesKeys: ageDeviceBars.seriesKeys,
        points: ageDeviceBars.points,
      },
      {
        id: 'age-by-state',
        title: 'Age band by state',
        type: 'stacked-bar',
        fullWidth: true,
        seriesKeys: ageStateBars.seriesKeys,
        points: ageStateBars.points,
      },
      {
        id: 'dob-hist',
        title: 'DOB-year histogram over time',
        type: 'heatmap',
        fullWidth: true,
        rowKeys: [...new Set(dobHist.map((r) => r.week))].slice(-12),
        colKeys: birthYears,
        points: dobPoints,
      },
      {
        id: 'age-vs-stage',
        title: 'Age band vs drop-off stage',
        type: 'heatmap',
        fullWidth: true,
        rowKeys: [...AGE_BANDS],
        colKeys: topStages,
        points: vsStage.map((r) => ({
          row: r.band,
          col: r.stage,
          value: n(r.sessions),
        })),
      },
      {
        id: 'age-completion',
        title: 'Age band vs completion',
        type: 'bar',
        seriesKeys: ['value'],
        points: rates.map((r) => ({
          label: r.band,
          value: pct(n(r.completed), n(r.leads)),
        })),
      },
      {
        id: 'age-multi',
        title: 'Age band vs multi-vehicle rate',
        type: 'bar',
        seriesKeys: ['value'],
        points: rates.map((r) => ({
          label: r.band,
          value: pct(n(r.multi), n(r.leads)),
        })),
      },
      {
        id: 'age-insured',
        title: 'Age band vs insured rate',
        type: 'bar',
        seriesKeys: ['value'],
        points: rates.map((r) => ({
          label: r.band,
          value: pct(n(r.insured), n(r.leads)),
        })),
      },
      {
        id: 'senior-weekly',
        title: 'Senior (65+) share of leads, weekly',
        type: 'line',
        fullWidth: true,
        seriesKeys: ['value'],
        points: seniorWeekly.map((r) => ({
          label: r.week,
          value: pct(n(r.senior), n(r.total)),
        })),
      },
    ],
  }
}

async function riskInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const rows = await queryJson<{
    day: string
    leads: string
    insured: string
    dui: string
    fault: string
    homeowner: string
    married: string
    military: string
    bundle: string
    male: string
    female: string
  }>(
    `
    SELECT
      ${dayKey} AS day,
      countIf(${LEAD_EVENT}) AS leads,
      countIf(${LEAD_EVENT} AND lower(${FIELD('currently_insured')}) IN ('yes','true','y')) AS insured,
      countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_dui')}) IN ('yes','true','y')) AS dui,
      countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_fault')}) IN ('yes','true','y','atfault')) AS fault,
      countIf(${LEAD_EVENT} AND (
        lower(${FIELD('homeowner')}) IN ('yes','true','y','own')
        OR lower(${FIELD('driver_0_homeowner')}) IN ('yes','true','y','own')
      )) AS homeowner,
      countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_married')}) IN ('yes','true','y','married')) AS married,
      countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_military')}) IN ('yes','true','y')) AS military,
      countIf(${LEAD_EVENT} AND (
        lower(${FIELD('include_bundle')}) IN ('yes','true','y')
        OR lower(${FIELD('bundle')}) IN ('yes','true','y')
      )) AS bundle,
      countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_gender')}) IN ('m','male')) AS male,
      countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_gender')}) IN ('f','female')) AS female
    FROM events_raw
    WHERE ${ctx.where}
    GROUP BY day
    ORDER BY day ASC
    `,
    ctx.p,
  )

  const carriers = await queryJson<{ day: string; carrier: string; leads: string }>(
    `
    SELECT
      ${dayKey} AS day,
      if(${FIELD('currently_insured_company')} = '' AND ${FIELD('insco_company')} = '',
        '(none)',
        if(${FIELD('currently_insured_company')} != '', ${FIELD('currently_insured_company')}, ${FIELD('insco_company')})
      ) AS carrier,
      count() AS leads
    FROM events_raw
    WHERE ${ctx.where} AND ${LEAD_EVENT}
    GROUP BY day, carrier
    ORDER BY day ASC
    LIMIT 2000
    `,
    ctx.p,
  )

  const coverage = await queryJson<{ day: string; length: string; leads: string }>(
    `
    SELECT
      ${dayKey} AS day,
      if(${FIELD('continuous_coverage')} = '', '(unknown)', ${FIELD('continuous_coverage')}) AS length,
      count() AS leads
    FROM events_raw
    WHERE ${ctx.where} AND ${LEAD_EVENT}
    GROUP BY day, length
    ORDER BY day ASC
    `,
    ctx.p,
  )

  const ratePoints = rows.map((r) => {
    const leads = n(r.leads)
    return {
      label: r.day,
      Insured: pct(n(r.insured), leads),
      DUI: pct(n(r.dui), leads),
      'At-fault': pct(n(r.fault), leads),
      Homeowner: pct(n(r.homeowner), leads),
      Married: pct(n(r.married), leads),
      Military: pct(n(r.military), leads),
      Bundle: pct(n(r.bundle), leads),
    }
  })

  const genderPoints = rows.map((r) => ({
    label: r.day,
    Male: n(r.male),
    Female: n(r.female),
  }))

  const topCarriers = [
    ...new Set(
      carriers
        .filter((r) => r.carrier !== '(none)')
        .map((r) => ({ c: r.carrier, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.c),
    ),
  ].slice(0, TOP_N)

  const carrierPivot = pivotSeries(
    carriers.map((r) => ({
      bucket: r.day,
      series: topCarriers.includes(r.carrier) ? r.carrier : 'Other',
      value: n(r.leads),
    })),
    [...topCarriers, 'Other'],
  )

  const coverageKeys = [
    ...new Set(coverage.map((r) => r.length)),
  ].slice(0, 8)
  const coveragePivot = pivotSeries(
    coverage.map((r) => ({
      bucket: r.day,
      series: r.length,
      value: n(r.leads),
    })),
    coverageKeys,
  )

  const last = rows[rows.length - 1]
  const leads = n(last?.leads)

  return {
    section: 'risk',
    kpis: [
      kpi('insured', 'Insured %', pct(n(last?.insured), leads), 'percent'),
      kpi('dui', 'DUI %', pct(n(last?.dui), leads), 'percent'),
      kpi('homeowner', 'Homeowner %', pct(n(last?.homeowner), leads), 'percent'),
      kpi('bundle', 'Bundle %', pct(n(last?.bundle), leads), 'percent'),
    ],
    charts: [
      {
        id: 'risk-rates',
        title: 'Profile rates over time',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: [
          'Insured',
          'DUI',
          'At-fault',
          'Homeowner',
          'Married',
          'Military',
          'Bundle',
        ],
        points: ratePoints,
      },
      {
        id: 'gender-split',
        title: 'Gender split over time',
        type: 'stacked-area',
        seriesKeys: ['Male', 'Female'],
        points: genderPoints,
      },
      {
        id: 'carrier-mix',
        title: 'Current carrier mix',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: carrierPivot.seriesKeys,
        points: carrierPivot.points,
      },
      {
        id: 'coverage-mix',
        title: 'Coverage length mix',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: coveragePivot.seriesKeys,
        points: coveragePivot.points,
      },
    ],
  }
}

async function vehicleInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')

  const [makes, vehicleAge, second, multiBySource, ageVsCoverage] =
    await Promise.all([
      queryJson<{ day: string; make: string; leads: string }>(
        `
        SELECT
          ${dayKey} AS day,
          if(${FIELD('car_0_make')} = '', '(unknown)', ${FIELD('car_0_make')}) AS make,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day, make
        ORDER BY day ASC
        LIMIT 2000
        `,
        ctx.p,
      ),
      queryJson<{ day: string; age_bucket: string; leads: string }>(
        `
        SELECT
          ${dayKey} AS day,
          multiIf(
            toInt32OrZero(${FIELD('car_0_year')}) = 0, 'Unknown',
            toYear(today()) - toInt32OrZero(${FIELD('car_0_year')}) <= 2, '0-2 yrs',
            toYear(today()) - toInt32OrZero(${FIELD('car_0_year')}) <= 5, '3-5 yrs',
            toYear(today()) - toInt32OrZero(${FIELD('car_0_year')}) <= 10, '6-10 yrs',
            '11+ yrs'
          ) AS age_bucket,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day, age_bucket
        ORDER BY day ASC
        `,
        ctx.p,
      ),
      queryJson<{ day: string; second_rate: string; leads: string }>(
        `
        SELECT
          ${dayKey} AS day,
          countIf(
            ${FIELD('car_1_year')} != '' OR ${FIELD('car_1_make')} != ''
            OR lower(${FIELD('second_vehicle')}) IN ('yes','true','y')
          ) AS second_rate,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day
        ORDER BY day ASC
        `,
        ctx.p,
      ),
      queryJson<{ source: string; multi: string; leads: string }>(
        `
        SELECT
          if(utm_source = '', '(direct)', utm_source) AS source,
          countIf(
            ${FIELD('car_1_year')} != '' OR ${FIELD('car_1_make')} != ''
            OR lower(${FIELD('second_vehicle')}) IN ('yes','true','y')
          ) AS multi,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY source
        ORDER BY leads DESC
        LIMIT 15
        `,
        ctx.p,
      ),
      queryJson<{ age_bucket: string; coverage: string; leads: string }>(
        `
        SELECT
          multiIf(
            toInt32OrZero(${FIELD('car_0_year')}) = 0, 'Unknown',
            toYear(today()) - toInt32OrZero(${FIELD('car_0_year')}) <= 2, '0-2 yrs',
            toYear(today()) - toInt32OrZero(${FIELD('car_0_year')}) <= 5, '3-5 yrs',
            toYear(today()) - toInt32OrZero(${FIELD('car_0_year')}) <= 10, '6-10 yrs',
            '11+ yrs'
          ) AS age_bucket,
          if(${FIELD('continuous_coverage')} = '', '(unknown)', ${FIELD('continuous_coverage')}) AS coverage,
          count() AS leads
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY age_bucket, coverage
        LIMIT 100
        `,
        ctx.p,
      ),
    ])

  const topMakes = [
    ...new Set(
      makes
        .filter((r) => r.make !== '(unknown)')
        .map((r) => ({ m: r.make, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.m),
    ),
  ].slice(0, TOP_N)

  const makePivot = pivotSeries(
    makes.map((r) => ({
      bucket: r.day,
      series: topMakes.includes(r.make) ? r.make : 'Other',
      value: n(r.leads),
    })),
    [...topMakes, 'Other'],
  )

  const ageBuckets = ['0-2 yrs', '3-5 yrs', '6-10 yrs', '11+ yrs', 'Unknown']
  const agePivot = pivotSeries(
    vehicleAge.map((r) => ({
      bucket: r.day,
      series: r.age_bucket,
      value: n(r.leads),
    })),
    ageBuckets,
  )

  const coverageKeys = [
    ...new Set(ageVsCoverage.map((r) => r.coverage)),
  ].slice(0, 8)

  return {
    section: 'vehicle',
    kpis: [
      kpi(
        'second_rate',
        'Second-vehicle %',
        pct(
          second.reduce((s, r) => s + n(r.second_rate), 0),
          second.reduce((s, r) => s + n(r.leads), 0),
        ),
        'percent',
      ),
      kpi('makes', 'Top makes', topMakes.length),
    ],
    charts: [
      {
        id: 'make-dist',
        title: 'Car make distribution',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: makePivot.seriesKeys,
        points: makePivot.points,
      },
      {
        id: 'vehicle-age',
        title: 'Vehicle age distribution',
        type: 'stacked-bar',
        fullWidth: true,
        seriesKeys: agePivot.seriesKeys,
        points: agePivot.points,
      },
      {
        id: 'second-vehicle',
        title: 'Second-vehicle rate',
        type: 'line',
        seriesKeys: ['value'],
        points: second.map((r) => ({
          label: r.day,
          value: pct(n(r.second_rate), n(r.leads)),
        })),
      },
      {
        id: 'multi-by-source',
        title: 'Multi-vehicle share by source',
        type: 'horizontal-bar',
        seriesKeys: ['value'],
        yKey: 'label',
        points: multiBySource.map((r) => ({
          label: r.source,
          value: pct(n(r.multi), n(r.leads)),
        })),
      },
      {
        id: 'age-vs-coverage',
        title: 'Vehicle age vs coverage length',
        type: 'heatmap',
        fullWidth: true,
        rowKeys: ageBuckets,
        colKeys: coverageKeys,
        points: ageVsCoverage.map((r) => ({
          row: r.age_bucket,
          col: r.coverage,
          value: n(r.leads),
        })),
      },
    ],
  }
}

async function qualityInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')

  const [dups, domains, missing, tfBySource, bots] = await Promise.all([
    queryJson<{ day: string; dups: string; leads: string }>(
      `
      SELECT
        day,
        countIf(cnt > 1) AS dups,
        count() AS leads
      FROM (
        SELECT
          ${dayKey} AS day,
          coalesce(nullIf(fingerprint, ''), session_id) AS fp,
          count() AS cnt
        FROM events_raw
        WHERE ${ctx.where} AND ${LEAD_EVENT}
        GROUP BY day, fp
      )
      GROUP BY day
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; domain: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        multiIf(
          ${FIELD('email')} = '', '(none)',
          position(${FIELD('email')}, '@') > 0,
            lower(substring(${FIELD('email')}, position(${FIELD('email')}, '@') + 1)),
          '(invalid)'
        ) AS domain,
        count() AS leads
      FROM events_raw
      WHERE ${ctx.where} AND ${LEAD_EVENT}
      GROUP BY day, domain
      ORDER BY day ASC
      LIMIT 2000
      `,
      ctx.p,
    ),
    queryJson<{ day: string; missing: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        countIf(
          ${FIELD('email')} = ''
          OR ${FIELD('dob')} = '' AND ${FIELD('dob-0-year')} = ''
          OR ${FIELD('car_0_make')} = ''
        ) AS missing,
        count() AS leads
      FROM events_raw
      WHERE ${ctx.where} AND ${LEAD_EVENT}
      GROUP BY day
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; source: string; tf: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(utm_source = '', '(direct)', utm_source) AS source,
        countIf(${TF_EXPR}) AS tf,
        count() AS leads
      FROM events_raw
      WHERE ${ctx.where} AND ${LEAD_EVENT}
      GROUP BY day, source
      ORDER BY day ASC
      LIMIT 2000
      `,
      ctx.p,
    ),
    queryJson<{ day: string; bots: string; sessions: string }>(
      `
      SELECT
        ${dayKey} AS day,
        uniqExactIf(session_id,
          positionCaseInsensitive(browser, 'bot') > 0
          OR positionCaseInsensitive(browser, 'crawler') > 0
          OR fingerprint = ''
        ) AS bots,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day
      ORDER BY day ASC
      `,
      ctx.p,
    ),
  ])

  const topDomains = [
    ...new Set(
      domains
        .filter((r) => r.domain !== '(none)')
        .map((r) => ({ d: r.domain, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.d),
    ),
  ].slice(0, TOP_N)

  const domainPivot = pivotSeries(
    domains.map((r) => ({
      bucket: r.day,
      series: topDomains.includes(r.domain) ? r.domain : 'Other',
      value: n(r.leads),
    })),
    [...topDomains, 'Other'],
  )

  const topSources = [
    ...new Set(
      tfBySource
        .map((r) => ({ s: r.source, v: n(r.leads) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.s),
    ),
  ].slice(0, TOP_N)

  const tfPivot = pivotSeries(
    tfBySource
      .filter((r) => topSources.includes(r.source))
      .map((r) => ({
        bucket: r.day,
        series: r.source,
        value: pct(n(r.tf), n(r.leads)),
      })),
    topSources,
  )

  return {
    section: 'quality',
    kpis: [
      kpi(
        'dup_rate',
        'Dup lead %',
        pct(
          dups.reduce((s, r) => s + n(r.dups), 0),
          dups.reduce((s, r) => s + n(r.leads), 0),
        ),
        'percent',
      ),
      kpi(
        'bot_share',
        'Bot-suspected %',
        pct(
          bots.reduce((s, r) => s + n(r.bots), 0),
          bots.reduce((s, r) => s + n(r.sessions), 0),
        ),
        'percent',
      ),
    ],
    charts: [
      {
        id: 'dup-rate',
        title: 'Duplicate lead rate',
        type: 'line',
        seriesKeys: ['value'],
        points: dups.map((r) => ({
          label: r.day,
          value: pct(n(r.dups), n(r.leads)),
        })),
      },
      {
        id: 'email-domains',
        title: 'Email domain mix',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: domainPivot.seriesKeys,
        points: domainPivot.points,
      },
      {
        id: 'missing-fields',
        title: 'Missing-field rate',
        type: 'line',
        seriesKeys: ['value'],
        points: missing.map((r) => ({
          label: r.day,
          value: pct(n(r.missing), n(r.leads)),
        })),
      },
      {
        id: 'tf-by-source',
        title: 'TrustedForm coverage by source',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: tfPivot.seriesKeys,
        points: tfPivot.points,
      },
      {
        id: 'bot-share',
        title: 'Bot-suspected traffic share',
        type: 'line',
        seriesKeys: ['value'],
        points: bots.map((r) => ({
          label: r.day,
          value: pct(n(r.bots), n(r.sessions)),
        })),
      },
    ],
  }
}

export async function getExtendedInsights(
  section: InsightSectionId,
  ctx: Ctx,
): Promise<AnalyticsInsights> {
  switch (section) {
    case 'dropoff':
      return dropoffInsights(ctx)
    case 'device':
      return deviceInsights(ctx)
    case 'geo':
      return geoInsights(ctx)
    case 'experiment':
      return experimentInsights(ctx)
    case 'age':
      return ageInsights(ctx)
    case 'risk':
      return riskInsights(ctx)
    case 'vehicle':
      return vehicleInsights(ctx)
    case 'quality':
      return qualityInsights(ctx)
    default:
      return emptyAnalyticsInsights(section)
  }
}
