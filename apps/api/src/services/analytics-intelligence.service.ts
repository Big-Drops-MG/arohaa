import { formatDayOfWeek } from '../lib/day-of-week.js'
import { chToDayOfWeek, chToHour } from '../lib/analytics-timezone.js'
import type {
  AnalyticsInsights,
  IntelligenceBoard,
  IntelligenceWinner,
} from '../types/analytics-insights.js'
import {
  AGE_BAND_EXPR,
  AGE_BANDS,
  FIELD,
  LEAD_EVENT,
  ZIP_SUBMIT,
  kpi,
  n,
  pct,
  queryJson,
  type InsightsQueryCtx,
} from './analytics-insights.service.js'

type Ctx = InsightsQueryCtx

const MIN_SAMPLE = 20

function titleCase(value: string): string {
  if (!value || value === 'Unknown') return value || 'Unknown'
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function winner(input: Omit<IntelligenceWinner, 'enoughData'> & {
  enoughData?: boolean
}): IntelligenceWinner {
  return {
    ...input,
    enoughData:
      input.enoughData ??
      (input.sampleSize >= MIN_SAMPLE && Boolean(input.value) && input.value !== '—'),
  }
}

export async function intelligenceInsights(
  ctx: Ctx,
): Promise<AnalyticsInsights> {
  const [
    byState,
    byCity,
    byZip,
    byDevice,
    byAge,
    byGender,
    bySource,
    byHour,
    byDow,
    profile,
    dropStage,
    quality,
  ] = await Promise.all([
    queryJson<{ state: string; sessions: string; leads: string }>(
      `
      SELECT
        if(state = '', 'Unknown', state) AS state,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY state
      ORDER BY leads DESC
      LIMIT 40
      `,
      ctx.p,
    ),
    queryJson<{ city: string; sessions: string; leads: string }>(
      `
      SELECT
        if(city = '', 'Unknown', city) AS city,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
        AND city != ''
      GROUP BY city
      ORDER BY leads DESC
      LIMIT 40
      `,
      ctx.p,
    ),
    queryJson<{ zip: string; sessions: string; leads: string }>(
      `
      SELECT
        if(zipcode = '', 'Unknown', zipcode) AS zip,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
        AND zipcode != ''
      GROUP BY zip
      ORDER BY leads DESC
      LIMIT 40
      `,
      ctx.p,
    ),
    queryJson<{
      device: string
      sessions: string
      leads: string
    }>(
      `
      SELECT
        if(device IN ('mobile','tablet','desktop'), device, 'desktop') AS device,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY device
      ORDER BY leads DESC
      `,
      ctx.p,
    ),
    queryJson<{ band: string; leads: string }>(
      `
      SELECT
        ${AGE_BAND_EXPR} AS band,
        count() AS leads
      FROM events_raw
      WHERE ${ctx.where}
        AND ${LEAD_EVENT}
      GROUP BY band
      `,
      ctx.p,
    ),
    queryJson<{ gender: string; leads: string }>(
      `
      SELECT
        multiIf(
          lower(${FIELD('driver_0_gender')}) IN ('m','male'), 'Male',
          lower(${FIELD('driver_0_gender')}) IN ('f','female'), 'Female',
          'Unknown'
        ) AS gender,
        count() AS leads
      FROM events_raw
      WHERE ${ctx.where}
        AND ${LEAD_EVENT}
      GROUP BY gender
      `,
      ctx.p,
    ),
    queryJson<{ source: string; sessions: string; leads: string }>(
      `
      SELECT
        if(nullIf(utm_source, '') = '', '(direct)', utm_source) AS source,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 25
      `,
      ctx.p,
    ),
    queryJson<{ hour: string; leads: string; zips: string; sessions: string }>(
      `
      SELECT
        ${chToHour('created_at')} AS hour,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY hour
      ORDER BY hour ASC
      `,
      ctx.p,
    ),
    queryJson<{ dow: string; leads: string; sessions: string }>(
      `
      SELECT
        ${chToDayOfWeek('created_at')} AS dow,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY dow
      ORDER BY dow ASC
      `,
      ctx.p,
    ),
    queryJson<{
      leads: string
      insured: string
      dui: string
      homeowner: string
      multi: string
    }>(
      `
      SELECT
        countIf(${LEAD_EVENT}) AS leads,
        countIf(${LEAD_EVENT} AND lower(${FIELD('currently_insured')}) IN ('yes','true','y')) AS insured,
        countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_dui')}) IN ('yes','true','y')) AS dui,
        countIf(${LEAD_EVENT} AND lower(${FIELD('homeowner')}) IN ('yes','true','y')) AS homeowner,
        countIf(${LEAD_EVENT} AND (
          ${FIELD('car_1_year')} != '' OR ${FIELD('car_1_make')} != ''
          OR lower(${FIELD('second_vehicle')}) IN ('yes','true','y')
        )) AS multi
      FROM events_raw
      WHERE ${ctx.where}
      `,
      ctx.p,
    ),
    queryJson<{ stage: string; sessions: string }>(
      `
      SELECT
        if(
          nullIf(JSONExtractString(properties, 'stepName'), '') = '',
          concat('Step ', toString(JSONExtractUInt(properties, 'stepIndex'))),
          JSONExtractString(properties, 'stepName')
        ) AS stage,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_step_view'
      GROUP BY stage
      ORDER BY sessions DESC
      LIMIT 12
      `,
      ctx.p,
    ),
    queryJson<{ leads: string; dups: string; bots: string; sessions: string }>(
      `
      SELECT
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        0 AS dups,
        uniqExactIf(
          session_id,
          positionCaseInsensitive(browser, 'bot') > 0
          OR positionCaseInsensitive(browser, 'crawler') > 0
        ) AS bots,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
      `,
      ctx.p,
    ),
  ])

  const rankByLeads = <T extends { leads: string; sessions?: string }>(
    rows: T[],
    labelOf: (row: T) => string,
  ) =>
    [...rows]
      .map((row) => ({
        label: labelOf(row),
        leads: n(row.leads),
        sessions: n(row.sessions),
        finishRate: pct(n(row.leads), n(row.sessions)),
      }))
      .sort((a, b) => b.leads - a.leads || b.finishRate - a.finishRate)

  const states = rankByLeads(byState, (r) => r.state)
  const cities = rankByLeads(byCity, (r) => r.city)
  const zips = rankByLeads(byZip, (r) => r.zip)
  const devices = rankByLeads(byDevice, (r) => titleCase(r.device)).sort(
    (a, b) => b.finishRate - a.finishRate || b.leads - a.leads,
  )
  const sources = rankByLeads(bySource, (r) => r.source)

  const ageTotal = byAge.reduce((sum, r) => sum + n(r.leads), 0)
  const ages = AGE_BANDS.filter((band) => band !== 'Unknown')
    .map((band) => {
      const row = byAge.find((r) => r.band === band)
      return {
        label: band,
        leads: n(row?.leads),
        share: pct(n(row?.leads), ageTotal),
      }
    })
    .sort((a, b) => b.leads - a.leads)

  const male = n(byGender.find((r) => r.gender === 'Male')?.leads)
  const female = n(byGender.find((r) => r.gender === 'Female')?.leads)
  const genderKnown = male + female
  const maleShare = pct(male, genderKnown)
  const femaleShare = pct(female, genderKnown)

  const hours = byHour
    .map((r) => ({
      label: `${String(n(r.hour)).padStart(2, '0')}:00`,
      hour: n(r.hour),
      leads: n(r.leads),
      sessions: n(r.sessions),
      finishRate: pct(n(r.leads), n(r.sessions)),
    }))
    .sort((a, b) => b.leads - a.leads)

  const daysRanked = byDow
    .map((r) => ({
      label: formatDayOfWeek(r.dow),
      leads: n(r.leads),
      sessions: n(r.sessions),
      finishRate: pct(n(r.leads), n(r.sessions)),
    }))
    .sort((a, b) => b.leads - a.leads)

  const bestState = states[0]
  const bestCity = cities[0]
  const bestZip = zips[0]
  const bestDevice = devices.find((d) => d.sessions >= MIN_SAMPLE) ?? devices[0]
  const bestAge = ages[0]
  const bestSource = sources[0]
  const bestDay = daysRanked[0]
  const bestHour = hours[0]

  const profileRow = profile[0]
  const profileLeads = n(profileRow?.leads)
  const qualityRow = quality[0]
  const topDrop = dropStage[0]

  const winners: IntelligenceWinner[] = [
    winner({
      id: 'state',
      label: 'Best state',
      value: bestState?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestState?.leads ?? 0,
      secondaryLabel: 'Finish rate',
      secondaryValue: bestState ? `${bestState.finishRate}%` : '—',
      sampleSize: bestState?.leads ?? 0,
    }),
    winner({
      id: 'city',
      label: 'Best city',
      value: bestCity?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestCity?.leads ?? 0,
      secondaryLabel: 'Finish rate',
      secondaryValue: bestCity ? `${bestCity.finishRate}%` : '—',
      sampleSize: bestCity?.leads ?? 0,
    }),
    winner({
      id: 'zip',
      label: 'Best ZIP',
      value: bestZip?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestZip?.leads ?? 0,
      secondaryLabel: 'Sessions',
      secondaryValue: bestZip?.sessions ?? 0,
      sampleSize: bestZip?.leads ?? 0,
    }),
    winner({
      id: 'device',
      label: 'Best device',
      value: bestDevice?.label ?? '—',
      metricLabel: 'Finish rate',
      metricValue: bestDevice?.finishRate ?? 0,
      secondaryLabel: 'Leads',
      secondaryValue: bestDevice?.leads ?? 0,
      sampleSize: bestDevice?.sessions ?? 0,
    }),
    winner({
      id: 'age',
      label: 'Best age group',
      value: bestAge?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestAge?.leads ?? 0,
      secondaryLabel: 'Share',
      secondaryValue: bestAge ? `${bestAge.share}%` : '—',
      sampleSize: bestAge?.leads ?? 0,
    }),
    winner({
      id: 'gender',
      label: 'Male / female mix',
      value:
        genderKnown >= MIN_SAMPLE
          ? `${maleShare}% male · ${femaleShare}% female`
          : '—',
      metricLabel: 'Known leads',
      metricValue: genderKnown,
      sampleSize: genderKnown,
      enoughData: genderKnown >= MIN_SAMPLE,
    }),
    winner({
      id: 'source',
      label: 'Best source',
      value: bestSource?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestSource?.leads ?? 0,
      secondaryLabel: 'Finish rate',
      secondaryValue: bestSource ? `${bestSource.finishRate}%` : '—',
      sampleSize: bestSource?.leads ?? 0,
    }),
    winner({
      id: 'day',
      label: 'Best day',
      value: bestDay?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestDay?.leads ?? 0,
      sampleSize: bestDay?.leads ?? 0,
    }),
    winner({
      id: 'hour',
      label: 'Best hour',
      value: bestHour?.label ?? '—',
      metricLabel: 'Leads',
      metricValue: bestHour?.leads ?? 0,
      sampleSize: bestHour?.leads ?? 0,
    }),
  ]

  const placeColumns = [
    { key: 'leads', label: 'Leads' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'finishRate', label: 'Finish rate' },
  ]

  const toPlaceRows = (
    rows: { label: string; leads: number; sessions: number; finishRate: number }[],
  ) =>
    rows.slice(0, 5).map((row) => ({
      label: row.label,
      values: {
        leads: row.leads,
        sessions: row.sessions,
        finishRate: `${row.finishRate}%`,
      },
    }))

  const locationTakeaway = (() => {
    if (!bestState || bestState.leads === 0) {
      return "Not enough location data yet to pick a clear winner."
    }
    if (bestState.leads < MIN_SAMPLE) {
      return `${bestState.label} is leading so far, but there is not enough data yet for a firm call.`
    }
    const volumeLeader = bestState.label
    const finishLeader = [...states]
      .filter((s) => s.sessions >= MIN_SAMPLE)
      .sort((a, b) => b.finishRate - a.finishRate)[0]
    if (
      volumeLeader &&
      finishLeader &&
      finishLeader.label !== volumeLeader &&
      finishLeader.finishRate > 0
    ) {
      return `${volumeLeader} brings the most leads; ${finishLeader.label} finishes forms more often.`
    }
    return `${volumeLeader} is your strongest state for leads in this period.`
  })()

  const boards: IntelligenceBoard[] = [
    {
      id: 'location',
      title: 'Location',
      columns: placeColumns,
      rows: [
        ...toPlaceRows(states).map((r) => ({
          ...r,
          label: `State · ${r.label}`,
        })),
        ...toPlaceRows(cities).map((r) => ({
          ...r,
          label: `City · ${r.label}`,
        })),
        ...toPlaceRows(zips).map((r) => ({
          ...r,
          label: `ZIP · ${r.label}`,
        })),
      ].slice(0, 15),
      takeaway: locationTakeaway,
    },
    {
      id: 'audience',
      title: 'Audience',
      columns: [
        { key: 'leads', label: 'Leads' },
        { key: 'detail', label: 'Detail' },
      ],
      rows: [
        ...ages.slice(0, 6).map((row) => ({
          label: `Age · ${row.label}`,
          values: { leads: row.leads, detail: `${row.share}% of leads` },
        })),
        ...devices.map((row) => ({
          label: `Device · ${row.label}`,
          values: {
            leads: row.leads,
            detail: `${row.finishRate}% finish rate`,
          },
        })),
        {
          label: 'Gender mix',
          values: {
            leads: genderKnown,
            detail:
              genderKnown > 0
                ? `${maleShare}% male · ${femaleShare}% female`
                : 'Not collected yet',
          },
        },
      ],
      takeaway: (() => {
        const agePart = bestAge?.leads
          ? `Most leads are ${bestAge.label}`
          : 'Age mix is still forming'
        const devicePart = bestDevice?.label
          ? `mainly on ${bestDevice.label.toLowerCase()}`
          : null
        const genderPart =
          genderKnown >= MIN_SAMPLE
            ? `about ${maleShare}% male`
            : null
        return [agePart, devicePart, genderPart].filter(Boolean).join('; ') + '.'
      })(),
    },
    {
      id: 'acquisition',
      title: 'Acquisition',
      columns: placeColumns,
      rows: toPlaceRows(sources),
      takeaway: (() => {
        if (!bestSource || bestSource.leads === 0) {
          return 'Source mix will show once campaign traffic arrives.'
        }
        const finishLeader = [...sources]
          .filter((s) => s.sessions >= MIN_SAMPLE)
          .sort((a, b) => b.finishRate - a.finishRate)[0]
        if (
          finishLeader &&
          finishLeader.label !== bestSource.label &&
          finishLeader.finishRate > bestSource.finishRate
        ) {
          return `${bestSource.label} brings the most leads; ${finishLeader.label} completes more often.`
        }
        return `${bestSource.label} is your top lead source this period.`
      })(),
    },
    {
      id: 'timing',
      title: 'Timing',
      columns: [
        { key: 'leads', label: 'Leads' },
        { key: 'finishRate', label: 'Finish rate' },
      ],
      rows: [
        ...daysRanked.slice(0, 7).map((row) => ({
          label: `Day · ${row.label}`,
          values: { leads: row.leads, finishRate: `${row.finishRate}%` },
        })),
        ...hours.slice(0, 5).map((row) => ({
          label: `Hour · ${row.label}`,
          values: { leads: row.leads, finishRate: `${row.finishRate}%` },
        })),
      ],
      takeaway:
        bestDay && bestHour
          ? `${bestDay.label}s around ${bestHour.label} are your strongest window.`
          : 'Timing patterns will appear with more traffic.',
    },
    {
      id: 'profile',
      title: 'Profile signals',
      columns: [{ key: 'value', label: 'Share of leads' }],
      rows: [
        {
          label: 'Already have insurance',
          values: {
            value:
              profileLeads > 0
                ? `${pct(n(profileRow?.insured), profileLeads)}%`
                : '—',
          },
        },
        {
          label: 'Own their home',
          values: {
            value:
              profileLeads > 0
                ? `${pct(n(profileRow?.homeowner), profileLeads)}%`
                : '—',
          },
        },
        {
          label: 'DUI indicated',
          values: {
            value:
              profileLeads > 0
                ? `${pct(n(profileRow?.dui), profileLeads)}%`
                : '—',
          },
        },
        {
          label: 'Multi-vehicle',
          values: {
            value:
              profileLeads > 0
                ? `${pct(n(profileRow?.multi), profileLeads)}%`
                : '—',
          },
        },
        {
          label: 'Possible duplicate leads',
          values: {
            value:
              n(qualityRow?.leads) > 0
                ? `${pct(n(qualityRow?.dups), n(qualityRow?.leads))}%`
                : '—',
          },
        },
        {
          label: 'Bot-suspected traffic',
          values: {
            value:
              n(qualityRow?.sessions) > 0
                ? `${pct(n(qualityRow?.bots), n(qualityRow?.sessions))}%`
                : '—',
          },
        },
      ].filter((row) => row.values.value !== '—'),
      takeaway:
        profileLeads >= MIN_SAMPLE
          ? 'Use these signals when routing leads to partners or reviewing quality.'
          : 'Profile answers will show once more completed forms are collected.',
    },
  ]

  const actions: string[] = []
  if (bestSource && bestSource.leads >= MIN_SAMPLE) {
    actions.push(
      `Put more budget into ${bestSource.label} — it leads volume this period.`,
    )
  }
  if (bestAge && bestDevice && bestAge.leads >= MIN_SAMPLE) {
    actions.push(
      `Focus creatives on ${bestAge.label} on ${bestDevice.label.toLowerCase()}.`,
    )
  }
  if (bestState && bestState.leads >= MIN_SAMPLE) {
    const cityBit =
      bestCity && bestCity.leads >= MIN_SAMPLE ? ` / ${bestCity.label}` : ''
    actions.push(
      `Prioritize ${bestState.label}${cityBit} for partner routing.`,
    )
  }
  if (topDrop && n(topDrop.sessions) >= MIN_SAMPLE) {
    actions.push(
      `Review form step “${topDrop.stage}” — many people still view it; check if they drop afterward.`,
    )
  }
  if (bestDay && bestHour && (bestDay.leads >= MIN_SAMPLE || bestHour.leads >= MIN_SAMPLE)) {
    actions.push(
      `Schedule pushes and calls around ${bestDay.label} near ${bestHour.label}.`,
    )
  }
  if (actions.length === 0) {
    actions.push(
      'Collect more leads in this date range to unlock clear recommendations.',
    )
  }

  const totalLeads = states.reduce((s, r) => s + r.leads, 0)

  return {
    section: 'intelligence',
    kpis: [
      kpi('leads', 'Leads', totalLeads),
      kpi('states', 'States with leads', states.filter((s) => s.leads > 0).length),
      kpi('sources', 'Active sources', sources.filter((s) => s.leads > 0).length),
    ],
    charts: [],
    winners,
    boards,
    actions,
  }
}
