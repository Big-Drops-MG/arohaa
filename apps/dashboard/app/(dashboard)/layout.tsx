import { auth } from "@/auth"
import { Navbar } from "@/features/dashboard/view/Navbar"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { sql } from "drizzle-orm"
import { redirect } from "next/navigation"

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) {
    redirect("/login")
  }

  const normalizedEmail = normalizeUserEmail(email)
  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalizedEmail),
  })

  if (!user?.isTwoFactorEnabled) {
    redirect("/authenticate")
  }

  const profileResult = await db.execute<{
    firstName: string | null
    lastName: string | null
    role: string | null
    name: string | null
  }>(sql`
    select
      to_jsonb(u)->>'firstName' as "firstName",
      to_jsonb(u)->>'lastName' as "lastName",
      to_jsonb(u)->>'role' as "role",
      coalesce(to_jsonb(u)->>'name', '') as "name"
    from "user" u
    where lower(u.email) = ${normalizedEmail}
    limit 1
  `)

  const profile = profileResult.rows[0]
  const fallbackName = profile?.name?.trim() || user.name?.trim() || ""
  const [fallbackFirstName = "Dashboard", ...rest] = fallbackName.split(/\s+/)
  const fallbackLastName = rest.join(" ")
  const firstName = profile?.firstName?.trim() || fallbackFirstName
  const lastName = profile?.lastName?.trim() || fallbackLastName
  const role = profile?.role?.trim() || "Profile"

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Navbar firstName={firstName} lastName={lastName} role={role} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
