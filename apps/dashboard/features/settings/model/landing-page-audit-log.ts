export type LandingPageAuditLogEntry = {
  id: string
  action: string
  beforePayload: Record<string, unknown> | null
  afterPayload: Record<string, unknown> | null
  traceId: string | null
  createdAt: string
  actorUserId: string
  actorEmail: string | null
  actorFirstName: string | null
  actorLastName: string | null
}

export type LandingPageAuditLogsResponse = {
  items: LandingPageAuditLogEntry[]
}
