export type LeadFraudLabel = "legit" | "fraud"

export type LeadSignalCoverage = "sufficient" | "partial" | "insufficient"

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

export type InteractionLogEntry = {
  at: string
  offsetMs: number
  message: string
  kind: number | null
}

export type InteractionLogData = {
  sessionId: string
  startedAt: string | null
  formId: string | null
  firstName: string
  lastName: string
  email: string
  fraud: LeadFraudAssessment | null
  entries: InteractionLogEntry[]
}
