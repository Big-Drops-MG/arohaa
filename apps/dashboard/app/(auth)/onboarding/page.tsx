import { auth } from "@/auth"
import { OnboardingPage } from "@/features/auth/view/OnboardingPage"
import { isApprovedAccess } from "@/lib/server/access-status"
import { listRoleNames } from "@/lib/server/roles"
import { pageMetadata } from "@/lib/site-metadata"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export const metadata = pageMetadata("Complete Your Profile")

export default async function OnboardingRoutePage() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) {
    redirect("/login")
  }

  const user = await db.query.users.findFirst({
    where: whereUserEmail(normalizeUserEmail(email)),
  })

  if (!user) {
    redirect("/login")
  }

  if (user.isTwoFactorEnabled) {
    const cookieStore = await cookies()
    const hasVerified2FA =
      cookieStore.get("arohaa_2fa_verified")?.value === "true"
    if (!hasVerified2FA) {
      redirect("/login?requiresTwoFactor=true")
    }
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
