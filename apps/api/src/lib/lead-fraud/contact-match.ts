import {
  getClickHouseClient,
  LEAD_CONTACT_KEYS_TABLE,
  LEAD_REVIEW_TABLE,
} from '../../services/clickhouse.service.js'

type CHJson<T> = { data: T[] }

export const RELATED_MATCH_FETCH_LIMIT = 500
export const RELATED_MATCH_LOOKBACK_DEFAULT = 30

export type ContactMatchStatus =
  | 'ok'
  | 'unavailable'
  | 'no_keys'
  | 'no_tenant'

export type RelatedMatchBasis = 'phone' | 'email' | 'phone_and_email'

export type ContactMatchRow = {
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
  phoneHashes: string[]
  emailHashes: string[]
  matchBasis: RelatedMatchBasis
  matchDegree: 'direct' | 'indirect'
  conflicts: string[]
}

export type ContactMatchResult = {
  status: ContactMatchStatus
  tenantWorkspaceId: string
  sessionId: string
  landingPageId: string
  lookbackDays: number
  totalDirect: number
  totalIndirect: number
  truncated: boolean
  rows: ContactMatchRow[]
  findings: Array<{ code: string; detail: string }>
  evidenceToken: string
}

type SeedKey = {
  key_type: string
  key_hash: string
  first_name: string
  last_name: string
  email_masked: string
  zip: string
  utm_source: string
  landing_page_id: string
  submitted_at: string
}

type RawMatch = {
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

function truthyFlag(v: number | boolean | string | undefined): boolean {
  return v === 1 || v === true || v === '1'
}

function submissionGroupKeyExpr(): string {
  return `multiIf(k.event_id != '', k.event_id, toString(k.submitted_at))`
}

function conflictCodes(
  seed: {
    first_name: string
    last_name: string
    emailHashes: string[]
    zip: string
  },
  other: {
    first_name: string
    last_name: string
    emailHashes: string[]
    zip: string
  },
  phoneMatched: boolean,
): string[] {
  const out: string[] = []
  if (!phoneMatched) return out
  const sn = `${seed.first_name} ${seed.last_name}`.trim().toLowerCase()
  const on = `${other.first_name} ${other.last_name}`.trim().toLowerCase()
  if (sn && on && sn !== on) out.push('same_phone_different_names')
  if (seed.emailHashes.length > 0 && other.emailHashes.length > 0) {
    const overlap = seed.emailHashes.some((h) => other.emailHashes.includes(h))
    if (!overlap) out.push('same_phone_different_emails')
  }
  if (seed.zip && other.zip && seed.zip !== other.zip) {
    out.push('contact_location_changed')
  }
  return out
}

async function loadSeedKeys(input: {
  tenant: string
  landingPageId: string
  sessionId: string
}): Promise<SeedKey[]> {
  const ch = getClickHouseClient()
  const seedRes = await ch.query({
    format: 'JSON',
    query_params: {
      tenant: input.tenant,
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
        utm_source,
        landing_page_id,
        toString(submitted_at) AS submitted_at
      FROM ${LEAD_CONTACT_KEYS_TABLE} FINAL
      WHERE tenant_workspace_id = {tenant:String}
        AND session_id = {sid:String}
        AND landing_page_id = {lpid:String}
    `,
  })
  return ((await seedRes.json()) as CHJson<SeedKey>).data ?? []
}

async function queryMatchesByHashes(input: {
  tenant: string
  phones: string[]
  emails: string[]
  days: number
  excludeSessions: string[]
  limit: number
}): Promise<RawMatch[]> {
  if (input.phones.length === 0 && input.emails.length === 0) return []
  const ch = getClickHouseClient()
  const groupKey = submissionGroupKeyExpr()
  const relatedRes = await ch.query({
    format: 'JSON',
    query_params: {
      tenant: input.tenant,
      phones: input.phones,
      emails: input.emails,
      days: input.days,
      exclude: input.excludeSessions,
      lim: input.limit,
    },
    query: `
      SELECT
        k.landing_page_id AS landing_page_id,
        k.session_id AS session_id,
        any(k.event_id) AS event_id,
        toString(max(k.submitted_at)) AS submitted_at,
        any(k.utm_source) AS utm_source,
        any(k.utm_s1) AS utm_s1,
        any(k.utm_campaign) AS utm_campaign,
        any(k.first_name) AS first_name,
        any(k.last_name) AS last_name,
        any(k.email_masked) AS email_masked,
        any(k.zip) AS zip,
        max(k.key_type = 'phone') AS has_phone,
        max(k.key_type = 'email') AS has_email
      FROM ${LEAD_CONTACT_KEYS_TABLE} AS k FINAL
      WHERE k.tenant_workspace_id = {tenant:String}
        AND k.session_id NOT IN {exclude:Array(String)}
        AND k.submitted_at >= now64(3) - INTERVAL {days:UInt32} DAY
        AND (
          (k.key_type = 'phone' AND length({phones:Array(String)}) > 0 AND k.key_hash IN {phones:Array(String)})
          OR (k.key_type = 'email' AND length({emails:Array(String)}) > 0 AND k.key_hash IN {emails:Array(String)})
        )
      GROUP BY k.landing_page_id, k.session_id, ${groupKey}
      ORDER BY max(k.submitted_at) DESC
      LIMIT {lim:UInt32}
    `,
  })
  return ((await relatedRes.json()) as CHJson<RawMatch>).data ?? []
}


async function loadAllKeysForSessions(input: {
  tenant: string
  sessions: Array<{ landingPageId: string; sessionId: string }>
}): Promise<{
  phoneHashes: string[]
  emailHashes: string[]
  emailHashesBySession: Map<string, string[]>
  phoneHashesBySession: Map<string, string[]>
}> {
  const empty = {
    phoneHashes: [] as string[],
    emailHashes: [] as string[],
    emailHashesBySession: new Map<string, string[]>(),
    phoneHashesBySession: new Map<string, string[]>(),
  }
  if (input.sessions.length === 0) return empty
  const ch = getClickHouseClient()
  const sids = [...new Set(input.sessions.map((s) => s.sessionId))]
  const lpids = [...new Set(input.sessions.map((s) => s.landingPageId))]
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      tenant: input.tenant,
      sids,
      lpids,
    },
    query: `
      SELECT
        landing_page_id,
        session_id,
        key_type,
        key_hash
      FROM ${LEAD_CONTACT_KEYS_TABLE} FINAL
      WHERE tenant_workspace_id = {tenant:String}
        AND session_id IN {sids:Array(String)}
        AND landing_page_id IN {lpids:Array(String)}
        AND key_hash != ''
    `,
  })
  const rows =
    (
      (await res.json()) as CHJson<{
        landing_page_id: string
        session_id: string
        key_type: string
        key_hash: string
      }>
    ).data ?? []

  const allowed = new Set(
    input.sessions.map((s) => `${s.landingPageId}:${s.sessionId}`),
  )
  const phones = new Set<string>()
  const emails = new Set<string>()
  const emailHashesBySession = new Map<string, string[]>()
  const phoneHashesBySession = new Map<string, string[]>()

  for (const row of rows) {
    const key = `${row.landing_page_id}:${row.session_id}`
    if (!allowed.has(key)) continue
    const hash = row.key_hash.trim()
    if (!hash) continue
    if (row.key_type === 'phone') {
      phones.add(hash)
      const list = phoneHashesBySession.get(key) ?? []
      if (!list.includes(hash)) list.push(hash)
      phoneHashesBySession.set(key, list)
    } else if (row.key_type === 'email') {
      emails.add(hash)
      const list = emailHashesBySession.get(key) ?? []
      if (!list.includes(hash)) list.push(hash)
      emailHashesBySession.set(key, list)
    }
  }
  return {
    phoneHashes: [...phones],
    emailHashes: [...emails],
    emailHashesBySession,
    phoneHashesBySession,
  }
}

function dedupeSameEventId(rows: ContactMatchRow[]): {
  rows: ContactMatchRow[]
  droppedRetries: number
} {
  const seen = new Set<string>()
  const out: ContactMatchRow[] = []
  let droppedRetries = 0
  for (const row of rows) {
    const eid = row.eventId.trim()
    if (eid) {
      if (seen.has(eid)) {
        droppedRetries += 1
        continue
      }
      seen.add(eid)
    }
    out.push(row)
  }
  return { rows: out, droppedRetries }
}

function buildEvidenceToken(input: {
  status: ContactMatchStatus
  seedPhoneHashes: string[]
  seedEmailHashes: string[]
  totalDirect: number
  totalIndirect: number
  latestRelatedAt: string
  seedSubmittedAt: string
  truncated?: boolean
}): string {
  return [
    input.status,
    input.seedPhoneHashes.slice().sort().join(','),
    input.seedEmailHashes.slice().sort().join(','),
    String(input.totalDirect),
    String(input.totalIndirect),
    input.latestRelatedAt,
    input.seedSubmittedAt,
    input.truncated ? 'truncated' : 'full',
  ].join('|')
}

export async function loadRelatedContactMatches(input: {
  tenantWorkspaceId: string
  landingPageId: string
  sessionId: string
  lookbackDays?: number
  limit?: number
  offset?: number
}): Promise<ContactMatchResult> {
  const tenant = input.tenantWorkspaceId.trim()
  const lookbackDays = Math.min(
    90,
    Math.max(1, input.lookbackDays ?? RELATED_MATCH_LOOKBACK_DEFAULT),
  )
  const limit = Math.min(
    RELATED_MATCH_FETCH_LIMIT,
    Math.max(1, input.limit ?? 25),
  )
  const offset = Math.max(0, input.offset ?? 0)
  const fetchLimit = RELATED_MATCH_FETCH_LIMIT

  const base = (status: ContactMatchStatus): ContactMatchResult => ({
    status,
    tenantWorkspaceId: tenant,
    sessionId: input.sessionId,
    landingPageId: input.landingPageId,
    lookbackDays,
    totalDirect: 0,
    totalIndirect: 0,
    truncated: false,
    rows: [],
    findings:
      status === 'no_tenant'
        ? [
            {
              code: 'matching_unavailable',
              detail: 'Organisation id missing; cross-page matching disabled',
            },
          ]
        : status === 'unavailable'
          ? [
              {
                code: 'matching_unavailable',
                detail:
                  'Related-contact matching temporarily unavailable; conflicts unknown',
              },
            ]
          : status === 'no_keys'
            ? [
                {
                  code: 'no_contact_keys',
                  detail: 'No contact keys available for this submission',
                },
              ]
            : [],
    evidenceToken: buildEvidenceToken({
      status,
      seedPhoneHashes: [],
      seedEmailHashes: [],
      totalDirect: 0,
      totalIndirect: 0,
      latestRelatedAt: '',
      seedSubmittedAt: '',
    }),
  })

  if (!tenant) return base('no_tenant')

  try {
    const seedKeys = await loadSeedKeys({
      tenant,
      landingPageId: input.landingPageId,
      sessionId: input.sessionId,
    })
    if (seedKeys.length === 0) return base('no_keys')

    const seedPhoneHashes = seedKeys
      .filter((k) => k.key_type === 'phone' && k.key_hash)
      .map((k) => k.key_hash)
    const seedEmailHashes = seedKeys
      .filter((k) => k.key_type === 'email' && k.key_hash)
      .map((k) => k.key_hash)
    if (seedPhoneHashes.length === 0 && seedEmailHashes.length === 0) {
      return base('no_keys')
    }
    const seed = seedKeys[0]!

    const directRaw = await queryMatchesByHashes({
      tenant,
      phones: seedPhoneHashes,
      emails: seedEmailHashes,
      days: lookbackDays,
      excludeSessions: [input.sessionId],
      limit: fetchLimit,
    })

    const directSessions = directRaw.map((r) => ({
      landingPageId: r.landing_page_id,
      sessionId: r.session_id,
    }))
    const allDirectKeys = await loadAllKeysForSessions({
      tenant,
      sessions: directSessions,
    })

    const bridgePhones = allDirectKeys.phoneHashes.filter(
      (h) => !seedPhoneHashes.includes(h),
    )
    const bridgeEmails = allDirectKeys.emailHashes.filter(
      (h) => !seedEmailHashes.includes(h),
    )

    const excludeForIndirect = [
      input.sessionId,
      ...directRaw.map((r) => r.session_id),
    ]
    const indirectRaw =
      bridgePhones.length > 0 || bridgeEmails.length > 0
        ? await queryMatchesByHashes({
            tenant,
            phones: bridgePhones,
            emails: bridgeEmails,
            days: lookbackDays,
            excludeSessions: excludeForIndirect,
            limit: fetchLimit,
          })
        : []

    const indirectSessions = indirectRaw.map((r) => ({
      landingPageId: r.landing_page_id,
      sessionId: r.session_id,
    }))
    const allIndirectKeys = await loadAllKeysForSessions({
      tenant,
      sessions: indirectSessions,
    })

    const pages = new Set<string>([seed.landing_page_id])
    const partners = new Set<string>()
    if (seed.utm_source) partners.add(seed.utm_source)

    const mapRow = (
      r: RawMatch,
      degree: 'direct' | 'indirect',
      keyMaps: {
        emailHashesBySession: Map<string, string[]>
        phoneHashesBySession: Map<string, string[]>
      },
    ): ContactMatchRow => {
      const sk = `${r.landing_page_id}:${r.session_id}`
      const phoneHashes = keyMaps.phoneHashesBySession.get(sk) ?? []
      const emailHashes = keyMaps.emailHashesBySession.get(sk) ?? []
      const hasPhone =
        truthyFlag(r.has_phone) ||
        phoneHashes.some((h) => seedPhoneHashes.includes(h)) ||
        phoneHashes.length > 0
      const hasEmail =
        truthyFlag(r.has_email) ||
        emailHashes.some((h) => seedEmailHashes.includes(h)) ||
        emailHashes.length > 0
      const phoneMatched = phoneHashes.some((h) => seedPhoneHashes.includes(h))
      const matchBasis: RelatedMatchBasis =
        phoneMatched && emailHashes.some((h) => seedEmailHashes.includes(h))
          ? 'phone_and_email'
          : phoneMatched
            ? 'phone'
            : hasEmail
              ? 'email'
              : hasPhone
                ? 'phone'
                : 'email'
      const conflicts =
        degree === 'indirect'
          ? []
          : conflictCodes(
              {
                first_name: seed.first_name,
                last_name: seed.last_name,
                emailHashes: seedEmailHashes,
                zip: seed.zip,
              },
              {
                first_name: r.first_name,
                last_name: r.last_name,
                emailHashes,
                zip: r.zip,
              },
              phoneMatched,
            )
      pages.add(r.landing_page_id)
      if (r.utm_source) partners.add(r.utm_source)
      return {
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
        phoneHashes,
        emailHashes,
        matchBasis,
        matchDegree: degree,
        conflicts,
      }
    }

    const mapped = [
      ...directRaw.map((r) => mapRow(r, 'direct', allDirectKeys)),
      ...indirectRaw.map((r) => mapRow(r, 'indirect', allIndirectKeys)),
    ]

    const { rows: deduped, droppedRetries } = dedupeSameEventId(mapped)
    const directRows = deduped.filter((r) => r.matchDegree === 'direct')
    const indirectRows = deduped.filter((r) => r.matchDegree === 'indirect')
    const findings: Array<{ code: string; detail: string }> = []

    if (droppedRetries > 0) {
      findings.push({
        code: 'delivery_retries_deduped',
        detail: `${droppedRetries} confirmed delivery retry(ies) removed (same event_id)`,
      })
    }
    if (pages.size > 1) {
      findings.push({
        code: 'contact_repeated_across_pages',
        detail: `Contact appears across ${pages.size} landing pages (informational; not one person)`,
      })
    }
    if (partners.size > 1) {
      findings.push({
        code: 'contact_repeated_across_partners',
        detail: 'Contact appears across multiple partners (informational)',
      })
    }
    if (directRows.some((m) => m.conflicts.includes('same_phone_different_names'))) {
      findings.push({
        code: 'same_phone_different_names',
        detail: 'Same phone with different names on related submissions',
      })
    }
    if (
      directRows.some((m) => m.conflicts.includes('same_phone_different_emails'))
    ) {
      findings.push({
        code: 'same_phone_different_emails',
        detail: 'Same phone with different email hashes on related submissions',
      })
    }
    if (directRows.some((m) => m.conflicts.includes('contact_location_changed'))) {
      findings.push({
        code: 'contact_location_changed',
        detail: 'ZIP differs across related submissions',
      })
    }
    if (indirectRows.length > 0) {
      findings.push({
        code: 'indirect_contact_bridge',
        detail: `${indirectRows.length} indirect match(es) via shared contact bridge — not treated as the same person`,
      })
    }
    const hitFetchCap =
      directRaw.length >= fetchLimit || indirectRaw.length >= fetchLimit
    if (hitFetchCap) {
      findings.push({
        code: 'matching_truncated',
        detail: `Related-contact matching hit the shared fetch cap (${fetchLimit}); results may be incomplete — do not treat the list as exhaustive`,
      })
    }

    const sessionIds = [
      ...new Set(deduped.map((r) => r.sessionId)),
    ]
    if (sessionIds.length > 0) {
      try {
        const ch = getClickHouseClient()
        const revRes = await ch.query({
          format: 'JSON',
          query_params: { tenant, sids: sessionIds },
          query: `
            SELECT session_id
            FROM ${LEAD_REVIEW_TABLE} FINAL
            WHERE tenant_workspace_id = {tenant:String}
              AND session_id IN {sids:Array(String)}
              AND decision = 'marked_invalid'
          `,
        })
        const invalid =
          (
            (await revRes.json()) as CHJson<{ session_id: string }>
          ).data ?? []
        for (const row of invalid) {
          findings.push({
            code: 'related_submission_marked_invalid',
            detail: `Related session ${row.session_id} was marked invalid (context only)`,
          })
        }
      } catch {
        /* optional */
      }
    }

    const combined = [...directRows, ...indirectRows].sort(
      (a, b) =>
        Date.parse(b.submittedAt.includes('T') ? b.submittedAt : `${b.submittedAt.replace(' ', 'T')}Z`) -
        Date.parse(a.submittedAt.includes('T') ? a.submittedAt : `${a.submittedAt.replace(' ', 'T')}Z`),
    )
    const totalDirect = directRows.length
    const totalIndirect = indirectRows.length
    const page = combined.slice(offset, offset + limit)
    const latestRelatedAt = combined[0]?.submittedAt || ''

    return {
      status: 'ok',
      tenantWorkspaceId: tenant,
      sessionId: input.sessionId,
      landingPageId: input.landingPageId,
      lookbackDays,
      totalDirect,
      totalIndirect,
      truncated:
        offset + page.length < combined.length || hitFetchCap,
      rows: page,
      findings,
      evidenceToken: buildEvidenceToken({
        status: 'ok',
        seedPhoneHashes,
        seedEmailHashes,
        totalDirect,
        totalIndirect,
        latestRelatedAt,
        seedSubmittedAt: seed.submitted_at || '',
        truncated:
          offset + page.length < combined.length || hitFetchCap,
      }),
    }
  } catch {
    return base('unavailable')
  }
}

export async function contactRiskFromMatches(
  match: ContactMatchResult,
): Promise<{
  status: ContactMatchStatus
  contactMatchTruncated: boolean
  contactRepeatedAcrossPages: boolean
  contactRepeatedAcrossPartners: boolean
  samePhoneDifferentNames: boolean
  samePhoneDifferentEmails: boolean
  contactLocationChanged: boolean
  relatedMarkedInvalidCount: number
  evidenceToken: string
}> {
  const invalidCount = match.findings.filter(
    (f) => f.code === 'related_submission_marked_invalid',
  ).length
  return {
    status: match.status,
    contactMatchTruncated:
      match.truncated ||
      match.findings.some((f) => f.code === 'matching_truncated'),
    contactRepeatedAcrossPages: match.findings.some(
      (f) => f.code === 'contact_repeated_across_pages',
    ),
    contactRepeatedAcrossPartners: match.findings.some(
      (f) => f.code === 'contact_repeated_across_partners',
    ),
    samePhoneDifferentNames: match.findings.some(
      (f) => f.code === 'same_phone_different_names',
    ),
    samePhoneDifferentEmails: match.findings.some(
      (f) => f.code === 'same_phone_different_emails',
    ),
    contactLocationChanged: match.findings.some(
      (f) => f.code === 'contact_location_changed',
    ),
    relatedMarkedInvalidCount: invalidCount,
    evidenceToken: match.evidenceToken,
  }
}
