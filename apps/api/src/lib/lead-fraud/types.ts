export type LeadFraudLabel = 'legit' | 'fraud'

export type LeadSignalCoverage = 'sufficient' | 'partial' | 'insufficient'

export type LeadFraudFinding = {
  code: string
  detail: string
  subject?: 'visit' | 'submission' | 'related_group' | 'partner'
  severity?: 'info' | 'low' | 'medium' | 'high'
  evidenceRefs?: string[]
  observedAt?: string
  evidenceCutoff?: string
  source?: string
  availability?: 'available' | 'unavailable' | 'unsupported'
  contributesToScore?: boolean
  modelVersion?: string
  featureVersion?: string
  shadow?: boolean
  proposedScoreDelta?: number
}

export type LeadFraudAssessment = {
  score: number | null
  scoreAvailable: boolean
  label: LeadFraudLabel
  effectiveLabel: LeadFraudLabel
  coverage: LeadSignalCoverage
  findings: LeadFraudFinding[]
  reasons: string[]
  modelVersion: string
  shadowScore?: number | null
  shadowProposedDelta?: number
}

export type TrustedFormEvidenceTier = 'missing' | 'url_present' | 'verified'

export type AttributionConfidence =
  | 'unknown'
  | 'submit_only'
  | 'first_matches_submit'
  | 'first_differs_from_submit'

export type LeadFraudFeatures = {
  fingerprint: string
  browser: string
  formSubmitted: boolean
  email: string
  firstName: string
  lastName: string
  formZipEntered: string
  zip: string
  geoZip: string
  stateField: string
  geoState: string
  geoCountry: string
  geoCountryCode: string
  geoCity: string
  locationComparison: 'consistent' | 'minor_difference' | 'inconsistency' | 'unavailable'
  locationComparisonDetail: string
  networkClass: 'known_proxy_list' | 'hosting_network' | 'no_known_match' | 'unavailable'
  networkAsn: number | null
  networkOrg: string
  networkEvidenceSource: string
  networkEvidenceAsOf: string
  networkDetail: string
  trustedFormUrl: string
  trustedFormEvidenceTier: TrustedFormEvidenceTier
  clientIpHash: string
  fillDurationMs: number | null
  typedCount: number
  pasteCount: number
  pastedEmail: boolean
  pastedName: boolean
  pastedPhone: boolean
  hasFormStarted: boolean
  hasFieldInteraction: boolean
  fiBehaviorKnown: boolean
  fingerprintSessionsSameDay: number
  fingerprintSubmits24h: number
  ipHashSubmits24h: number
  emailDomainSubmits24h: number
  emailDomainIsCommonConsumer: boolean
  fieldCount: number
  velocityWindowKnown: boolean
  contactMatchStatus: 'ok' | 'unavailable' | 'no_keys' | 'no_tenant'
  contactMatchTruncated: boolean
  contactRepeatedAcrossPages: boolean
  contactRepeatedAcrossPartners: boolean
  samePhoneDifferentNames: boolean
  samePhoneDifferentEmails: boolean
  contactLocationChanged: boolean
  relatedMarkedInvalidCount: number
  evidenceToken: string
  submitUtmSource: string
  firstObservedUtmSource: string
  submitUtmCampaign: string
  firstObservedUtmCampaign: string
  clickId: string
  clickIdReuseCount24h: number | null
  attributionConfidence: AttributionConfidence
  evidenceCutoffMs: number
  shadowExtraFindings: LeadFraudFinding[]
  sdkVersion: string
  sdkCapabilities: string
  utmSourceReputation:
    | 'clean'
    | 'location_mismatch_cluster'
    | 'unknown'
  utmSourceSubmitCount: number
  utmSourceMismatchCount: number
}

export type LeadRiskRow = {
  workspace_id: string
  session_id: string
  score: number
  label: string
  reasons: string[]
  features_json: string
  model_version: string
  scored_at: string
  override_label: string
  override_by: string
  override_at: string
  override_note: string
  coverage?: string
  findings_json?: string
  tenant_workspace_id?: string
  phone_hash?: string
  email_hash?: string
}

export type FiLogItem = {
  offsetMs: number
  message: string
  kind: number | null
}
