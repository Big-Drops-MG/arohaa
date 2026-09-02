import { auth } from "@/auth"
import { PendingAccessPage } from "@/features/auth/view/PendingAccessPage"
import { isApprovedAccess } from "@/lib/server/access-status"
import { pageMetadata } from "@/lib/site-metadata"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"
import { sessionNeedsTwoFactorChallenge } from "@/lib/server/session-2fa"

export const metadata = pageMetadata("Access Pending")

export default async function PendingAccessRoutePage() {
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

  if (!user.firstName?.trim() || !user.lastName?.trim() || !user.role?.trim()) {
    redirect("/onboarding")
  }

  if (isApprovedAccess(user.accessStatus)) {
    redirect("/dashboard")
  }

  const status = user.accessStatus === "rejected" ? "rejected" : "pending"

  return <PendingAccessPage status={status} />
}
