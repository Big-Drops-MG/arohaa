import type { InternalAccessLevel } from "@/features/team/model/access-level"

export type TeamMemberStatus = "active" | "inactive"

export type TeamMemberKind = "internal" | "external"

export type TeamMember = {
  id: string
  name: string
  email: string
  roleLabel: string
  initials: string
  /** Google SSO / profile photo URL when available. */
  imageUrl: string | null
  isCurrentUser: boolean
  status: TeamMemberStatus
  kind: TeamMemberKind
  accessLevel: InternalAccessLevel
  roleKey?: string
  lastSeenAt: string | null
}

export type AccessRequestItem = {
  id: string
  name: string
  email: string
  roleLabel: string
  initials: string
  imageUrl: string | null
}

export type TeamDashboardData = {
  members: TeamMember[]
  accessRequests: AccessRequestItem[]
  canReviewAccessRequests: boolean
  canManageAccessLevels: boolean
  canViewMemberLogs: boolean
  canManageExternalMembers: boolean
}
