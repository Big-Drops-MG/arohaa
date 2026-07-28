export const ACCESS_STATUSES = ["pending", "approved", "rejected"] as const

export type AccessStatus = (typeof ACCESS_STATUSES)[number]

export function isAccessStatus(
  value: string | null | undefined
): value is AccessStatus {
  return value === "pending" || value === "approved" || value === "rejected"
}

export function isApprovedAccess(status: string | null | undefined): boolean {
  return status === "approved"
}

/** Where to send a fully authenticated user after login / 2FA. */
export function resolvePostAuthPath(user: {
  firstName?: string | null
  lastName?: string | null
  role?: string | null
  accessStatus?: string | null
}): string {
  if (!user.firstName?.trim() || !user.lastName?.trim() || !user.role?.trim()) {
    return "/onboarding"
  }
  if (!isApprovedAccess(user.accessStatus)) {
    return "/pending-access"
  }
  return "/dashboard"
}
