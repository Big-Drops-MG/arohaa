import { sql } from "drizzle-orm"
import { users } from "./schema/auth.js"

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase()
}

export function whereUserEmail(normalizedLower: string) {
  return sql`lower(${users.email}) = ${normalizedLower}`
}
