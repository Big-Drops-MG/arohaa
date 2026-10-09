export type LeadFraudLabel = "legit" | "fraud"

export type LeadFraudAssessment = {
  /** Trust score 0–100 (higher = more legitimate). */
  score: number
  label: LeadFraudLabel
  effectiveLabel: LeadFraudLabel
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
