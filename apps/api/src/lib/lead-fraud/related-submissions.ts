import {
  getClickHouseClient,
  LEAD_CONTACT_KEYS_TABLE,
  LEAD_REVIEW_TABLE,
  LEAD_RISK_TABLE,
} from '../../services/clickhouse.service.js'

type CHJson<T> = { data: T[] }

export type RelatedMatchBasis = 'phone' | 'email' | 'phone_and_email'

export type RelatedSubmissionRow = {
  tenantWorkspaceId: string
  landingPageId: string
  sessionId: string
  eventId: string
  submittedAt: string
  utmSource: string
  utmS1: string
  utmCampaign: string
  firstName: string
  lastName: string
  emailMasked: string
  zip: string
  matchBasis: RelatedMatchBasis
  matchDegree: 'direct' | 'indirect'
  conflicts: string[]
  trustScore: number | null
  scoreAvailable: boolean
  coverage: string
  reviewStatus: string
  decision: string
  callOutcome: string
}

export type RelatedSubmissionsResult = {
  tenantWorkspaceId: string
  sessionId: string
  landingPageId: string
  lookbackDays: number
  totalDirect: number
  totalIndirect: number
  truncated: boolean
  rows: RelatedSubmissionRow[]
  findings: Array<{ code: string; detail: string }>
}

function parseMs(raw: string): number {
  const t = Date.parse(
    String(raw || '').includes('T')
      ? String(raw)
      : `${String(raw).replace(' ', 'T')}Z`,
  )
  return Number.isFinite(t) ? t : 0
}

function conflictCodes(
  seed: {
    first_name: string
    last_name: string
    email_masked: string
    zip: string
  },
  other: {
    first_name: string
    last_name: string
    email_masked: string
    zip: string
  },
): string[] {
  const out: string[] = []
  const sn = `${seed.first_name} ${seed.last_name}`.trim().toLowerCase()
  const on = `${other.first_name} ${other.last_name}`.trim().toLowerCase()
  if (sn && on && sn !== on) out.push('same_phone_different_names')
  if (
    seed.email_masked &&
    other.email_masked &&
    seed.email_masked !== other.email_masked
  ) {
    out.push('same_phone_different_emails')
  }
  if (seed.zip && other.zip && seed.zip !== other.zip) {
    out.push('contact_location_changed')
  }
  if ((!seed.zip && other.zip) || (seed.zip && !other.zip)) {
    /* missing ≠ conflict */
  }
  return out
}

export async function getRelatedSubmissions(input: {
  tenantWorkspaceId: string
  landingPageId: string
  sessionId: string
  lookbackDays?: number
  limit?: number
  offset?: number
}): Promise<RelatedSubmissionsResult> {
  const tenant = input.tenantWorkspaceId.trim()
  const empty: RelatedSubmissionsResult = {
    tenantWorkspaceId: tenant,
    sessionId: input.sessionId,
    landingPageId: input.landingPageId,
    lookbackDays: input.lookbackDays ?? 30,
    totalDirect: 0,
    totalIndirect: 0,
    truncated: false,
    rows: [],
    findings: tenant
      ? []
      : [
          {
            code: 'matching_unavailable',
            detail: 'Organisation id missing; cross-page matching disabled',
          },
        ],
  }
  if (!tenant) return empty

  const lookbackDays = Math.min(90, Math.max(1, input.lookbackDays ?? 30))
  const limit = Math.min(100, Math.max(1, input.limit ?? 25))
  const offset = Math.max(0, input.offset ?? 0)
  const ch = getClickHouseClient()

  const seedRes = await ch.query({
    format: 'JSON',
    query_params: {
      tenant,
      sid: input.sessionId,
      lpid: input.landingPageId,
    },
    query: `
      SELECT
        key_type,
        key_hash,
        first_name,
        last_name,
        email_masked,
        zip,
        toString(submitted_at) AS submitted_at,
        utm_source,
        landing_page_id
      FROM ${LEAD_CONTACT_KEYS_TABLE} FINAL
      WHERE tenant_workspace_id = {tenant:String}
        AND session_id = {sid:String}
        AND landing_page_id = {lpid:String}
    `,
  })
  const seedKeys =
    (
      (await seedRes.json()) as CHJson<{
        key_type: string
        key_hash: string
        first_name: string
        last_name: string
        email_masked: string
        zip: string
        submitted_at: string
        utm_source: string
        landing_page_id: string
      }>
    ).data ?? []

  if (seedKeys.length === 0) {
    return {
      ...empty,
      findings: [
        {
          code: 'no_contact_keys',
          detail: 'No contact keys available for this submission',
        },
      ],
    }
  }

  const phoneHashes = seedKeys
    .filter((k) => k.key_type === 'phone' && k.key_hash)
    .map((k) => k.key_hash)
  const emailHashes = seedKeys
    .filter((k) => k.key_type === 'email' && k.key_hash)
    .map((k) => k.key_hash)
  const seed = seedKeys[0]!

  const relatedRes = await ch.query({
    format: 'JSON',
    query_params: {
      tenant,
      phones: phoneHashes,
      emails: emailHashes,
      days: lookbackDays,
      sid: input.sessionId,
    },
    query: `
      SELECT
        landing_page_id,
        session_id,
        any(event_id) AS event_id,
        toString(max(submitted_at)) AS submitted_at,
        any(utm_source) AS utm_source,
        any(utm_s1) AS utm_s1,
        any(utm_campaign) AS utm_campaign,
        any(first_name) AS first_name,
        any(last_name) AS last_name,
        any(email_masked) AS email_masked,
        any(zip) AS zip,
        max(key_type = 'phone') AS has_phone,
        max(key_type = 'email') AS has_email
      FROM ${LEAD_CONTACT_KEYS_TABLE} FINAL
      WHERE tenant_workspace_id = {tenant:String}
        AND session_id != {sid:String}
        AND submitted_at >= now64(3) - INTERVAL {days:UInt32} DAY
        AND (
          (key_type = 'phone' AND length({phones:Array(String)}) > 0 AND key_hash IN {phones:Array(String)})
          OR (key_type = 'email' AND length({emails:Array(String)}) > 0 AND key_hash IN {emails:Array(String)})
        )
      GROUP BY landing_page_id, session_id
      ORDER BY submitted_at DESC
      LIMIT 500
    `,
  })

  type RelRow = {
    landing_page_id: string
    session_id: string
    event_id: string
    submitted_at: string
    utm_source: string
    utm_s1: string
    utm_campaign: string
    first_name: string
    last_name: string
    email_masked: string
    zip: string
    has_phone: number | boolean | string
    has_email: number | boolean | string
  }
  const related = ((await relatedRes.json()) as CHJson<RelRow>).data ?? []

  const sessionIds = related.map((r) => r.session_id)
  const riskBySession = new Map<
    string,
    { score: number; coverage: string; scoreAvailable: boolean }
  >()
  const reviewBySession = new Map<
    string,
    { review_status: string; decision: string; call_outcome: string }
  >()

  if (sessionIds.length > 0) {
    try {
      const riskRes = await ch.query({
        format: 'JSON',
        query_params: { sids: sessionIds },
        query: `
          SELECT session_id, score, coverage
          FROM ${LEAD_RISK_TABLE} FINAL
          WHERE session_id IN {sids:Array(String)}
        `,
      })
      for (const row of (
        (await riskRes.json()) as CHJson<{
          session_id: string
          score: number
          coverage: string
        }>
      ).data ?? []) {
        const coverage = row.coverage || 'partial'
        riskBySession.set(row.session_id, {
          score: Number(row.score) || 0,
          coverage,
          scoreAvailable: coverage !== 'insufficient',
        })
      }
    } catch {
      /* optional */
    }
    try {
      const revRes = await ch.query({
        format: 'JSON',
        query_params: { tenant, sids: sessionIds },
        query: `
          SELECT session_id, review_status, decision, call_outcome
          FROM ${LEAD_REVIEW_TABLE} FINAL
          WHERE tenant_workspace_id = {tenant:String}
            AND session_id IN {sids:Array(String)}
        `,
      })
      for (const row of (
        (await revRes.json()) as CHJson<{
          session_id: string
          review_status: string
          decision: string
          call_outcome: string
        }>
      ).data ?? []) {
        reviewBySession.set(row.session_id, row)
      }
    } catch {
      /* optional */
    }
  }

  const pages = new Set<string>()
  const partners = new Set<string>()
  const findings: Array<{ code: string; detail: string }> = []
  const mapped: RelatedSubmissionRow[] = related.map((r) => {
    const hasPhone = r.has_phone === 1 || r.has_phone === true || r.has_phone === '1'
    const hasEmail = r.has_email === 1 || r.has_email === true || r.has_email === '1'
    const matchBasis: RelatedMatchBasis =
      hasPhone && hasEmail
        ? 'phone_and_email'
        : hasPhone
          ? 'phone'
          : 'email'
    const conflicts =
      matchBasis === 'email'
        ? []
        : conflictCodes(seed, {
            first_name: r.first_name,
            last_name: r.last_name,
            email_masked: r.email_masked,
            zip: r.zip,
          })
    pages.add(r.landing_page_id)
    if (r.utm_source) partners.add(r.utm_source)
    const risk = riskBySession.get(r.session_id)
    const review = reviewBySession.get(r.session_id)
    if (review?.decision === 'marked_invalid') {
      findings.push({
        code: 'related_submission_marked_invalid',
        detail: `Related session ${r.session_id} was marked invalid`,
      })
    }
    return {
      tenantWorkspaceId: tenant,
      landingPageId: r.landing_page_id,
      sessionId: r.session_id,
      eventId: r.event_id,
      submittedAt: r.submitted_at,
      utmSource: r.utm_source,
      utmS1: r.utm_s1,
      utmCampaign: r.utm_campaign,
      firstName: r.first_name,
      lastName: r.last_name,
      emailMasked: r.email_masked,
      zip: r.zip,
      matchBasis,
      matchDegree: 'direct',
      conflicts,
      trustScore: risk?.scoreAvailable ? risk.score : null,
      scoreAvailable: risk?.scoreAvailable ?? false,
      coverage: risk?.coverage || '',
      reviewStatus: review?.review_status || 'unreviewed',
      decision: review?.decision || '',
      callOutcome: review?.call_outcome || '',
    }
  })

  if (pages.size > 0) {
    findings.push({
      code: 'contact_repeated_across_pages',
      detail: `Contact appears across ${pages.size + 1} landing pages`,
    })
  }
  if (partners.size > 1 || (partners.size === 1 && seed.utm_source && !partners.has(seed.utm_source))) {
    findings.push({
      code: 'contact_repeated_across_partners',
      detail: 'Contact appears across multiple partners',
    })
  }
  if (mapped.some((m) => m.conflicts.includes('same_phone_different_names'))) {
    findings.push({
      code: 'same_phone_different_names',
      detail: 'Same phone with different names on related submissions',
    })
  }
  if (mapped.some((m) => m.conflicts.includes('same_phone_different_emails'))) {
    findings.push({
      code: 'same_phone_different_emails',
      detail: 'Same phone with different emails on related submissions',
    })
  }
  if (mapped.some((m) => m.conflicts.includes('contact_location_changed'))) {
    findings.push({
      code: 'contact_location_changed',
      detail: 'ZIP differs across related submissions',
    })
  }

  void parseMs
  const totalDirect = mapped.length
  const page = mapped.slice(offset, offset + limit)
  return {
    tenantWorkspaceId: tenant,
    sessionId: input.sessionId,
    landingPageId: input.landingPageId,
    lookbackDays,
    totalDirect,
    totalIndirect: 0,
    truncated: offset + page.length < totalDirect,
    rows: page,
    findings,
  }
}
