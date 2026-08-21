import type { InternalAccessLevel } from "@/features/team/model/access-level"

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
  /** Internal members only; externals are always treated as read-only. */
  accessLevel: InternalAccessLevel
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
  /** Whether the current user can change internal access levels. */
  canManageAccessLevels: boolean
  /** Whether the current user can open member activity logs. */
  canViewMemberLogs: boolean
  /** Whether the current user can add/edit/remove external members. */
  canManageExternalMembers: boolean
}
