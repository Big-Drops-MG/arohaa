import { auth } from "@/auth"
import { Navbar } from "@/features/dashboard/view/Navbar"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
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

  if (!user.firstName?.trim() || !user.lastName?.trim() || !user.role?.trim()) {
    redirect("/onboarding")
  }

  const firstName = user.firstName?.trim() || "Dashboard"
  const lastName = user.lastName?.trim() || "User"
  const role = user.role?.trim() || "Profile"

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Navbar firstName={firstName} lastName={lastName} role={role} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
