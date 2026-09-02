import { auth } from "@/auth"
import { LoginPage } from "@/features/auth/view/LoginPage"
import { resolvePostAuthPath } from "@/lib/server/access-status"
import { pageMetadata } from "@/lib/site-metadata"
import { db, normalizeUserEmail, whereUserEmail } from "@workspace/database"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { sessionNeedsTwoFactorChallenge } from "@/lib/server/session-2fa"

export const metadata = pageMetadata("Sign In")

export default async function AuthPage(props: {
  searchParams: Promise<{ requiresTwoFactor?: string }>
}) {
  const session = await auth()
  const searchParams = await props.searchParams

  if (session?.user && searchParams?.requiresTwoFactor !== "true") {
    if (sessionNeedsTwoFactorChallenge(session)) {
      redirect("/login?requiresTwoFactor=true")
    }

    const email = session.user.email
    if (email) {
      const user = await db.query.users.findFirst({
        where: whereUserEmail(normalizeUserEmail(email)),
      })
      if (user) {
        redirect(resolvePostAuthPath(user))
      }
    }

    redirect("/dashboard")
  }
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPage />
    </Suspense>
  )
}
