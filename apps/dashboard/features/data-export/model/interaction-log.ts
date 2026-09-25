export type InteractionLogEntry = {
  at: string
  offsetMs: number
  message: string
}

export type InteractionLogData = {
  sessionId: string
  startedAt: string | null
  entries: InteractionLogEntry[]
}
