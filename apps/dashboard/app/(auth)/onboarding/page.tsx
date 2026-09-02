import { auth } from "@/auth"
import { OnboardingPage } from "@/features/auth/view/OnboardingPage"
import { isApprovedAccess } from "@/lib/server/access-status"
import { listRoleNames } from "@/lib/server/roles"
import { pageMetadata } from "@/lib/site-metadata"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"
import { sessionNeedsTwoFactorChallenge } from "@/lib/server/session-2fa"

export const metadata = pageMetadata("Complete Your Profile")

export default async function OnboardingRoutePage() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) {
    redirect("/login")
  }

  if (sessionNeedsTwoFactorChallenge(session)) {
    redirect("/login?requiresTwoFactor=true")
  }

  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(email)),
  })

  if (!user) {
    redirect("/login")
  }

  if (user.firstName?.trim() && user.lastName?.trim() && user.role?.trim()) {
    if (isApprovedAccess(user.accessStatus)) {
      redirect("/dashboard")
    }
    redirect("/pending-access")
  }

  const roleOptions = await listRoleNames()

  return <OnboardingPage roleOptions={roleOptions} />
}
