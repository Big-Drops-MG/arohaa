export type LeadFraudLabel = 'legit' | 'fraud'

export type LeadSignalCoverage = 'sufficient' | 'partial' | 'insufficient'

export type LeadFraudFinding = {
  code: string
  detail: string
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
}

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
  trustedFormUrl: string
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
  fieldCount: number
  velocityWindowKnown: boolean
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
