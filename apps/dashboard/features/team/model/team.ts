export type TeamMemberStatus = "active" | "inactive"

export type TeamMemberKind = "internal" | "external"

export type TeamMember = {
  id: string
  name: string
  email: string
  roleLabel: string
  initials: string
  isCurrentUser: boolean
  status: TeamMemberStatus
  kind: TeamMemberKind
  lastSeenAt: string | null
}

export type AccessRequestItem = {
  id: string
  name: string
  email: string
  roleLabel: string
  initials: string
}

export type TeamDashboardData = {
  members: TeamMember[]
  accessRequests: AccessRequestItem[]
  canReviewAccessRequests: boolean
}
