import { auth } from "@/auth"
import { Navbar } from "@/features/dashboard/view/Navbar"
import { DashboardNavigationShell } from "@/features/dashboard/view/DashboardNavigationShell"
import { getLandingPageNavItems } from "@/features/dashboard/controller/landing-pages"
import { isApprovedAccess } from "@/lib/server/access-status"
import { isExternalTeamKind } from "@/features/team/model/external-privileges"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { touchUserLastSeen } from "@/lib/server/user-last-seen"
import {
  sessionHasVerifiedTwoFactor,
  sessionNeedsTwoFactorChallenge,
} from "@/lib/server/session-2fa"

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

  if (sessionNeedsTwoFactorChallenge(session)) {
    redirect("/login?requiresTwoFactor=true")
  }

  const normalizedEmail = normalizeUserEmail(email)
  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalizedEmail),
  })

  if (!user?.isTwoFactorEnabled) {
    redirect("/authenticate")
  }

  if (!sessionHasVerifiedTwoFactor(session)) {
    redirect("/login?requiresTwoFactor=true")
  }

  if (
    !user.firstName?.trim() ||
    !user.lastName?.trim() ||
    !user.role?.trim() ||
    !user.roleId
  ) {
    redirect("/onboarding")
  }

  if (!isApprovedAccess(user.accessStatus)) {
    redirect("/pending-access")
  }

  const firstName = user.firstName?.trim() || "Dashboard"
  const lastName = user.lastName?.trim() || "User"
  const role = user.role?.trim() || "Profile"
  const showTeamAndOps = !isExternalTeamKind(user.teamKind)

  void touchUserLastSeen(user.id)

  const landingPageNavItems = await getLandingPageNavItems()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Navbar
        firstName={firstName}
        lastName={lastName}
        role={role}
        landingPageNavItems={landingPageNavItems}
        showTeamAndOps={showTeamAndOps}
      />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={null}>
          <DashboardNavigationShell>{children}</DashboardNavigationShell>
        </Suspense>
      </main>
    </div>
  )
}
