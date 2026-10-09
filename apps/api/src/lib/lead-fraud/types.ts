export type LeadFraudLabel = 'legit' | 'fraud'

export type LeadFraudAssessment = {
  /** Trust score 0–100 (higher = more legitimate). */
  score: number
  label: LeadFraudLabel
  effectiveLabel: LeadFraudLabel
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
  fingerprintSessionsSameDay: number
  fingerprintSubmits24h: number
  ipHashSubmits24h: number
  emailDomainSubmits24h: number
  fieldCount: number
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
}

export type FiLogItem = {
  offsetMs: number
  message: string
  kind: number | null
}
