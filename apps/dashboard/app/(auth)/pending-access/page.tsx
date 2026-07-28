import { auth } from "@/auth"
import { PendingAccessPage } from "@/features/auth/view/PendingAccessPage"
import { isApprovedAccess } from "@/lib/server/access-status"
import { pageMetadata } from "@/lib/site-metadata"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export const metadata = pageMetadata("Access Pending")

export default async function PendingAccessRoutePage() {
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

  if (!user.firstName?.trim() || !user.lastName?.trim() || !user.role?.trim()) {
    redirect("/onboarding")
  }

  if (isApprovedAccess(user.accessStatus)) {
    redirect("/dashboard")
  }

  const status = user.accessStatus === "rejected" ? "rejected" : "pending"

  return <PendingAccessPage status={status} />
}
