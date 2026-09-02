import { auth } from "@/auth"
import { GoogleAuthenticatorScreen } from "@/features/auth/view/GoogleAuthenticatorScreen"
import { pageMetadata } from "@/lib/site-metadata"
import { redirect } from "next/navigation"
import {
  sessionHasVerifiedTwoFactor,
  sessionNeedsTwoFactorChallenge,
} from "@/lib/server/session-2fa"

export const metadata = pageMetadata("Two-Factor Authentication")

export default async function GoogleAuthenticatorScreenPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  if (sessionNeedsTwoFactorChallenge(session)) {
    redirect("/login?requiresTwoFactor=true")
  }

  if (session.user.isTwoFactorEnabled && sessionHasVerifiedTwoFactor(session)) {
    redirect("/dashboard")
  }

  return <GoogleAuthenticatorScreen />
}
