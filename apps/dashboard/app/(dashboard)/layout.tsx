import { auth } from "@/auth"
import { SignOutButton } from "@/components/sign-out-button"
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

  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(email)),
  })

  if (!user?.isTwoFactorEnabled) {
    redirect("/authenticate")
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Arohaa
        </span>
        <SignOutButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
