import { auth } from "@/auth"
import { OnboardingPage } from "@/features/auth/view/OnboardingPage"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"

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

  if (user.firstName?.trim() && user.lastName?.trim() && user.role?.trim()) {
    redirect("/dashboard")
  }

  return <OnboardingPage />
}
