/** Roles that may manage internal access levels and view team activity logs. */
const TEAM_PRIVILEGE_ROLES = new Set(["ceo", "cfo"])

/** Named operators (matched on first + last name). */
const TEAM_PRIVILEGE_NAMES = new Set(["yash phadke", "sami wasta"])

/** Known operator emails (same domain pattern as data-export ACL). */
const TEAM_PRIVILEGE_EMAILS = new Set([
  "yash@bigdropsmarketing.com",
  "sami@bigdropsmarketing.com",
])

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function isTeamPrivilegeActor(actor: {
  email?: string | null
  role?: string | null
  firstName?: string | null
  lastName?: string | null
}): boolean {
  const email = actor.email ? normalizeKey(actor.email) : ""
  if (email && TEAM_PRIVILEGE_EMAILS.has(email)) return true

  const role = actor.role ? normalizeKey(actor.role) : ""
  if (role && TEAM_PRIVILEGE_ROLES.has(role)) return true

  const name = normalizeKey(`${actor.firstName ?? ""} ${actor.lastName ?? ""}`)
  return Boolean(name) && TEAM_PRIVILEGE_NAMES.has(name)
}
